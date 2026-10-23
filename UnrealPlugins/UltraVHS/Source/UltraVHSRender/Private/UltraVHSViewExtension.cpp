#include "UltraVHSViewExtension.h"

#include "UltraVHSShaders.h"
#include "CoreGlobals.h"
#include "PixelShaderUtils.h"
#include "RenderGraphBuilder.h"
#include "RenderGraphUtils.h"
#include "RenderingThread.h"
#include "RHIStaticStates.h"
#include "SceneView.h"

FUltraVHSViewExtension::FUltraVHSViewExtension(const FAutoRegister& AutoRegister, UWorld* InWorld)
	: FWorldSceneViewExtension(AutoRegister, InWorld)
{
}

void FUltraVHSViewExtension::SetProvider(UltraVHS::FParamsProvider InProvider)
{
	check(IsInGameThread());
	Provider = MoveTemp(InProvider);
}

bool FUltraVHSViewExtension::IsActiveThisFrame_Internal(const FSceneViewExtensionContext& Context) const
{
	if (!FWorldSceneViewExtension::IsActiveThisFrame_Internal(Context))
	{
		return false;
	}
	GameParams = FUltraVHSRenderParams();
	if (Provider && !Provider(GameParams))
	{
		GameParams.bEnabled = false;
	}
	return GameParams.bEnabled;
}

void FUltraVHSViewExtension::BeginRenderViewFamily(FSceneViewFamily& InViewFamily)
{
	// the render thread gets this frame's params ahead of the family's rendering (commands run in order)
	TSharedRef<FUltraVHSViewExtension, ESPMode::ThreadSafe> Self = StaticCastSharedRef<FUltraVHSViewExtension>(AsShared());
	ENQUEUE_RENDER_COMMAND(UltraVHSParams)([Self, Params = GameParams](FRHICommandListImmediate&)
	{
		Self->RenderParams = Params;
	});
}

#if UE_VERSION_OLDER_THAN(5, 5, 0)
void FUltraVHSViewExtension::SubscribeToPostProcessingPass(EPostProcessingPass Pass, UltraVHS::FPassDelegateArray& InOutPassCallbacks, bool bIsPassEnabled)
#else
void FUltraVHSViewExtension::SubscribeToPostProcessingPass(EPostProcessingPass Pass, const FSceneView& InView, UltraVHS::FPassDelegateArray& InOutPassCallbacks, bool bIsPassEnabled)
#endif
{
	if (Pass == EPostProcessingPass::Tonemap && RenderParams.bEnabled)
	{
		InOutPassCallbacks.Add(UltraVHS::FPassDelegate::CreateRaw(this, &FUltraVHSViewExtension::PostTonemap_RenderThread));
	}
}

FScreenPassTexture FUltraVHSViewExtension::PostTonemap_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessMaterialInputs& Inputs)
{
	const FUltraVHSRenderParams& P = RenderParams;

	// scene captures, reflections and planar mirrors stay clean: only the player's eye records to tape
	if (!P.bEnabled || View.bIsSceneCapture || View.bIsReflectionCapture || View.bIsPlanarReflection)
	{
		return Inputs.ReturnUntouchedSceneColorForPostProcessing(GraphBuilder);
	}

	const FScreenPassTexture SceneColor = FScreenPassTexture::CopyFromSlice(GraphBuilder, Inputs.GetInput(EPostProcessMaterialInput::SceneColor));
	if (!SceneColor.IsValid() || SceneColor.ViewRect.Area() <= 0)
	{
		return Inputs.ReturnUntouchedSceneColorForPostProcessing(GraphBuilder);
	}

	RDG_EVENT_SCOPE(GraphBuilder, "UltraVHS");

	FGlobalShaderMap* ShaderMap = GetGlobalShaderMap(View.GetFeatureLevel());
	FRHISamplerState* Bilinear = TStaticSamplerState<SF_Bilinear, AM_Clamp, AM_Clamp, AM_Clamp>::GetRHI();

	// the tape frame: TapeLines tall, 4:3 (or the view's shape)
	const FIntRect ViewRect = SceneColor.ViewRect;
	const FIntPoint ViewSize = ViewRect.Size();
	const float ViewAspect = float(ViewSize.X) / float(FMath::Max(ViewSize.Y, 1));
	const float TapeAspect = P.bCrop4x3 ? FMath::Min(4.f / 3.f, ViewAspect) : ViewAspect;
	const int32 Lines = FMath::Clamp(P.TapeLines, 120, 1080);
	const FIntPoint TapeSize(FMath::Max(1, FMath::RoundToInt(float(Lines) * TapeAspect)), Lines);
	const FIntRect TapeRect(FIntPoint::ZeroValue, TapeSize);
	const FVector2f TapeSizeF((float)TapeSize.X, (float)TapeSize.Y);

	const FRDGTextureDesc TapeDesc = FRDGTextureDesc::Create2D(TapeSize, PF_FloatRGBA, FClearValueBinding::Black,
		TexCreate_ShaderResource | TexCreate_RenderTargetable);
	FRDGTextureRef Capture = GraphBuilder.CreateTexture(TapeDesc, TEXT("UltraVHS.Capture"));
	FRDGTextureRef Tape = GraphBuilder.CreateTexture(TapeDesc, TEXT("UltraVHS.Tape"));

	// 1. the camera
	{
		FUltraVHSCapturePS::FParameters* Params = GraphBuilder.AllocParameters<FUltraVHSCapturePS::FParameters>();
		const FIntPoint Extent = SceneColor.Texture->Desc.Extent;
		Params->InputTexture = SceneColor.Texture;
		Params->InputSampler = Bilinear;
		Params->InputExtentInverse = FVector2f(1.f / (float)Extent.X, 1.f / (float)Extent.Y);
		Params->InputViewMin = FVector2f((float)ViewRect.Min.X, (float)ViewRect.Min.Y);
		Params->InputViewSize = FVector2f((float)ViewSize.X, (float)ViewSize.Y);
		Params->TapeSize = TapeSizeF;
		Params->Distortion = P.Distortion;
		Params->ChromaticAberration = P.ChromaticAberration;
		Params->Vignette = P.Vignette;
		Params->Saturation = P.Saturation;
		Params->BlackLevel = P.BlackLevel;
		Params->WhiteLevel = P.WhiteLevel;
		Params->RenderTargets[0] = FRenderTargetBinding(Capture, ERenderTargetLoadAction::ENoAction);

		TShaderMapRef<FUltraVHSCapturePS> Shader(ShaderMap);
		FPixelShaderUtils::AddFullscreenPass(GraphBuilder, ShaderMap, RDG_EVENT_NAME("UltraVHS.Camera %dx%d", TapeSize.X, TapeSize.Y), Shader, Params, TapeRect);
	}

	// last frame's tape for this view, if it's the same size
	const uint64 Frame = GFrameCounterRenderThread;
	for (auto It = Histories.CreateIterator(); It; ++It)
	{
		if (Frame - It.Value()->LastUsedFrame > 300)
		{
			It.RemoveCurrent();
		}
	}
	TSharedPtr<FHistory>& History = Histories.FindOrAdd(View.GetViewKey());
	if (!History.IsValid())
	{
		History = MakeShared<FHistory>();
	}
	History->LastUsedFrame = Frame;
	FRDGTextureRef Last = nullptr;
	if (P.Ghosting > 0.f && History->Target.IsValid() && History->Target->GetDesc().Extent == TapeSize)
	{
		Last = GraphBuilder.RegisterExternalTexture(History->Target);
	}

	// 2. the tape
	{
		FUltraVHSTapePS::FParameters* Params = GraphBuilder.AllocParameters<FUltraVHSTapePS::FParameters>();
		Params->InputTexture = Capture;
		Params->InputSampler = Bilinear;
		Params->HistoryTexture = Last ? Last : Capture;
		Params->HistorySampler = Bilinear;
		Params->TapeSize = TapeSizeF;
		Params->Time = View.Family ? (float)FMath::Fmod(View.Family->Time.GetRealTimeSeconds(), 3600.0) : 0.f;
		Params->FrameIndex = View.Family ? View.Family->FrameNumber : 0u;
		Params->LumaBlur = P.LumaBlur;
		Params->Sharpen = P.Sharpen;
		Params->SharpenRadius = P.SharpenRadius;
		Params->ChromaBlur = P.ChromaBlur;
		Params->ChromaShift = P.ChromaShift;
		Params->ChromaVerticalBlend = P.ChromaVerticalBlend;
		Params->Ghosting = Last ? FMath::Clamp(P.Ghosting, 0.f, 0.95f) : 0.f;
		Params->LumaNoise = P.LumaNoise;
		Params->ChromaNoise = P.ChromaNoise;
		Params->TrackingJitter = P.TrackingJitter;
		Params->TrackingError = P.TrackingError;
		Params->HeadSwitch = P.HeadSwitch;
		Params->Dropouts = P.Dropouts;
		Params->Glitch = P.Glitch;
		Params->RenderTargets[0] = FRenderTargetBinding(Tape, ERenderTargetLoadAction::ENoAction);

		TShaderMapRef<FUltraVHSTapePS> Shader(ShaderMap);
		FPixelShaderUtils::AddFullscreenPass(GraphBuilder, ShaderMap, RDG_EVENT_NAME("UltraVHS.Tape"), Shader, Params, TapeRect);
	}
	GraphBuilder.QueueTextureExtraction(Tape, &History->Target);

	// 3. the screen: into the pass's override output if we're last in the chain, else a new texture
	FScreenPassRenderTarget Output = Inputs.OverrideOutput;
	if (!Output.IsValid())
	{
		const FRDGTextureDesc OutputDesc = FRDGTextureDesc::Create2D(SceneColor.Texture->Desc.Extent, SceneColor.Texture->Desc.Format,
			FClearValueBinding::Black, TexCreate_ShaderResource | TexCreate_RenderTargetable);
		Output = FScreenPassRenderTarget(GraphBuilder.CreateTexture(OutputDesc, TEXT("UltraVHS.Output")), ViewRect, ERenderTargetLoadAction::ENoAction);
	}
	{
		FUltraVHSDisplayPS::FParameters* Params = GraphBuilder.AllocParameters<FUltraVHSDisplayPS::FParameters>();
		Params->InputTexture = Tape;
		Params->InputSampler = Bilinear;
		Params->TapeSize = TapeSizeF;
		Params->OutputViewMin = FVector2f((float)Output.ViewRect.Min.X, (float)Output.ViewRect.Min.Y);
		Params->OutputViewSize = FVector2f((float)Output.ViewRect.Width(), (float)Output.ViewRect.Height());
		Params->Scanlines = P.Scanlines;
		Params->RenderTargets[0] = Output.GetRenderTargetBinding();

		TShaderMapRef<FUltraVHSDisplayPS> Shader(ShaderMap);
		FPixelShaderUtils::AddFullscreenPass(GraphBuilder, ShaderMap, RDG_EVENT_NAME("UltraVHS.Screen"), Shader, Params, Output.ViewRect);
	}

	return FScreenPassTexture(Output.Texture, Output.ViewRect);
}
