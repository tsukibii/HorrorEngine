#pragma once

#include "CoreMinimal.h"
#include "Misc/EngineVersionComparison.h"
#include "PostProcess/PostProcessMaterialInputs.h"
#include "RendererInterface.h"
#include "SceneViewExtension.h"
#include "ScreenPass.h"
#include "Templates/Function.h"
#include "UltraVHSRenderParams.h"

namespace UltraVHS
{
	// SubscribeToPostProcessingPass took a view and a renamed delegate in 5.5 (CLAUDE.md in the plugin: "Engine
	// versions").
#if UE_VERSION_OLDER_THAN(5, 5, 0)
	using FPassDelegate = FAfterPassCallbackDelegate;
	using FPassDelegateArray = FAfterPassCallbackDelegateArray;
#else
	using FPassDelegate = FPostProcessingPassDelegate;
	using FPassDelegateArray = FPostProcessingPassDelegateArray;
#endif

	/** Game thread: fills the params for this frame; false (or bEnabled false) draws nothing. */
	using FParamsProvider = TFunction<bool(FUltraVHSRenderParams&)>;
}

/**
 * The VHS post-process for one world, run right after the tonemapper (display-referred colour). Made and owned by
 * UUltraVHSSubsystem; it asks the subsystem for its params each frame.
 */
class ULTRAVHSRENDER_API FUltraVHSViewExtension : public FWorldSceneViewExtension
{
public:
	FUltraVHSViewExtension(const FAutoRegister& AutoRegister, UWorld* InWorld);

	/** Game thread. */
	void SetProvider(UltraVHS::FParamsProvider InProvider);

	// ISceneViewExtension
	virtual void SetupViewFamily(FSceneViewFamily& InViewFamily) override {}
	virtual void SetupView(FSceneViewFamily& InViewFamily, FSceneView& InView) override {}
	virtual void BeginRenderViewFamily(FSceneViewFamily& InViewFamily) override;
#if UE_VERSION_OLDER_THAN(5, 5, 0)
	virtual void SubscribeToPostProcessingPass(EPostProcessingPass Pass, UltraVHS::FPassDelegateArray& InOutPassCallbacks, bool bIsPassEnabled) override;
#else
	virtual void SubscribeToPostProcessingPass(EPostProcessingPass Pass, const FSceneView& InView, UltraVHS::FPassDelegateArray& InOutPassCallbacks, bool bIsPassEnabled) override;
#endif

protected:
	virtual bool IsActiveThisFrame_Internal(const FSceneViewExtensionContext& Context) const override;

private:
	FScreenPassTexture PostTonemap_RenderThread(FRDGBuilder& GraphBuilder, const FSceneView& View, const FPostProcessMaterialInputs& Inputs);

	UltraVHS::FParamsProvider Provider;          // game thread
	mutable FUltraVHSRenderParams GameParams;    // game thread, refreshed when the frame asks whether we're active
	FUltraVHSRenderParams RenderParams;          // render thread

	/** Last frame's tape, per view, for the persistence. Render thread. */
	struct FHistory
	{
		TRefCountPtr<IPooledRenderTarget> Target;
		uint64 LastUsedFrame = 0;
	};
	TMap<uint32, TSharedPtr<FHistory>> Histories;
};
