#pragma once

#include "CoreMinimal.h"

/**
 * What the post-process draws this frame: plain numbers, copied to the render thread. The UltraVHS module fills it
 * from FUltraVHSSettings (the knobs and their meaning are documented there).
 */
struct FUltraVHSRenderParams
{
	bool bEnabled = false;

	// frame
	bool bCrop4x3 = true;
	int32 TapeLines = 480;

	// lens
	float Distortion = 0.f;
	float ChromaticAberration = 0.f;
	float Vignette = 0.f;

	// sensor
	FLinearColor BlackLevel = FLinearColor(0.f, 0.f, 0.f, 1.f);
	FLinearColor WhiteLevel = FLinearColor(1.f, 1.f, 1.f, 1.f);
	float Saturation = 1.f;

	// tape signal
	float LumaBlur = 1.f;
	float Sharpen = 0.f;
	float SharpenRadius = 3.f;
	float ChromaBlur = 1.f;
	float ChromaShift = 0.f;
	float ChromaVerticalBlend = 0.f;
	float Ghosting = 0.f;

	// tape wear
	float LumaNoise = 0.f;
	float ChromaNoise = 0.f;
	float TrackingJitter = 0.f;
	float TrackingError = 0.f;
	float HeadSwitch = 0.f;
	float Dropouts = 0.f;

	// screen
	float Scanlines = 0.f;

	// a moment's damage on top of everything (0..1), from UUltraVHSComponent::TriggerGlitch
	float Glitch = 0.f;
};
