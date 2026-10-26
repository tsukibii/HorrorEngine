#pragma once

#include "CoreMinimal.h"
#include "DataDrivenShaderPlatformInfo.h"
#include "GlobalShader.h"
#include "ShaderParameterStruct.h"
#include "RenderGraphResources.h"

// The three passes of Shaders/Private/UltraVHS.usf. Each struct names exactly what its entry point reads.

class FUltraVHSCapturePS : public FGlobalShader
{
public:
	DECLARE_GLOBAL_SHADER(FUltraVHSCapturePS);
	SHADER_USE_PARAMETER_STRUCT(FUltraVHSCapturePS, FGlobalShader);

	BEGIN_SHADER_PARAMETER_STRUCT(FParameters, )
		SHADER_PARAMETER_RDG_TEXTURE(Texture2D, InputTexture)
		SHADER_PARAMETER_SAMPLER(SamplerState, InputSampler)
		SHADER_PARAMETER(FVector2f, InputExtentInverse)
		SHADER_PARAMETER(FVector2f, InputViewMin)
		SHADER_PARAMETER(FVector2f, InputViewSize)
		SHADER_PARAMETER(FVector2f, TapeSize)
		SHADER_PARAMETER(float, Distortion)
		SHADER_PARAMETER(float, ChromaticAberration)
		SHADER_PARAMETER(float, Vignette)
		SHADER_PARAMETER(float, Saturation)
		SHADER_PARAMETER(FLinearColor, BlackLevel)
		SHADER_PARAMETER(FLinearColor, WhiteLevel)
		RENDER_TARGET_BINDING_SLOTS()
	END_SHADER_PARAMETER_STRUCT()

	static bool ShouldCompilePermutation(const FGlobalShaderPermutationParameters& Parameters)
	{
		return IsFeatureLevelSupported(Parameters.Platform, ERHIFeatureLevel::SM5);
	}
};

class FUltraVHSTapePS : public FGlobalShader
{
public:
	DECLARE_GLOBAL_SHADER(FUltraVHSTapePS);
	SHADER_USE_PARAMETER_STRUCT(FUltraVHSTapePS, FGlobalShader);

	BEGIN_SHADER_PARAMETER_STRUCT(FParameters, )
		SHADER_PARAMETER_RDG_TEXTURE(Texture2D, InputTexture)
		SHADER_PARAMETER_SAMPLER(SamplerState, InputSampler)
		SHADER_PARAMETER_RDG_TEXTURE(Texture2D, HistoryTexture)
		SHADER_PARAMETER_SAMPLER(SamplerState, HistorySampler)
		SHADER_PARAMETER(FVector2f, TapeSize)
		SHADER_PARAMETER(float, Time)
		SHADER_PARAMETER(uint32, FrameIndex)
		SHADER_PARAMETER(float, LumaBlur)
		SHADER_PARAMETER(float, Sharpen)
		SHADER_PARAMETER(float, SharpenRadius)
		SHADER_PARAMETER(float, ChromaBlur)
		SHADER_PARAMETER(float, ChromaShift)
		SHADER_PARAMETER(float, ChromaVerticalBlend)
		SHADER_PARAMETER(float, Ghosting)
		SHADER_PARAMETER(float, LumaNoise)
		SHADER_PARAMETER(float, ChromaNoise)
		SHADER_PARAMETER(float, TrackingJitter)
		SHADER_PARAMETER(float, TrackingError)
		SHADER_PARAMETER(float, HeadSwitch)
		SHADER_PARAMETER(float, Dropouts)
		SHADER_PARAMETER(float, Glitch)
		RENDER_TARGET_BINDING_SLOTS()
	END_SHADER_PARAMETER_STRUCT()

	static bool ShouldCompilePermutation(const FGlobalShaderPermutationParameters& Parameters)
	{
		return IsFeatureLevelSupported(Parameters.Platform, ERHIFeatureLevel::SM5);
	}
};

class FUltraVHSDisplayPS : public FGlobalShader
{
public:
	DECLARE_GLOBAL_SHADER(FUltraVHSDisplayPS);
	SHADER_USE_PARAMETER_STRUCT(FUltraVHSDisplayPS, FGlobalShader);

	BEGIN_SHADER_PARAMETER_STRUCT(FParameters, )
		SHADER_PARAMETER_RDG_TEXTURE(Texture2D, InputTexture)
		SHADER_PARAMETER_SAMPLER(SamplerState, InputSampler)
		SHADER_PARAMETER(FVector2f, TapeSize)
		SHADER_PARAMETER(FVector2f, OutputViewMin)
		SHADER_PARAMETER(FVector2f, OutputViewSize)
		SHADER_PARAMETER(float, Scanlines)
		RENDER_TARGET_BINDING_SLOTS()
	END_SHADER_PARAMETER_STRUCT()

	static bool ShouldCompilePermutation(const FGlobalShaderPermutationParameters& Parameters)
	{
		return IsFeatureLevelSupported(Parameters.Platform, ERHIFeatureLevel::SM5);
	}
};
