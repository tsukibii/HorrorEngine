#pragma once

#include "CoreMinimal.h"
#include "Camera/CameraModifier.h"
#include "UltraVHSHandheldModifier.generated.h"

class UUltraVHSComponent;

/**
 * The handheld camera, on the player's camera manager (UUltraVHSComponent adds it). Layers, all additive to the
 * view the game already made:
 *   drift   the hands' slow wander (two octaves of Perlin noise) and breathing; stronger while walking
 *   gait    a bob once per step and a sway once per two, scaled by how fast the view target walks on the ground
 *   turn    a bank into fast turns
 *   weight  the view trailing the look by RotationLag seconds (the controller's aim is untouched)
 */
UCLASS()
class ULTRAVHS_API UUltraVHSHandheldModifier : public UCameraModifier
{
	GENERATED_BODY()

public:
	UUltraVHSHandheldModifier();

	virtual bool ModifyCamera(float DeltaTime, FMinimalViewInfo& InOutPOV) override;

	/** Where the settings come from; nothing happens without it. */
	TWeakObjectPtr<UUltraVHSComponent> Source;

private:
	float Time = 0.f;
	float Walk = 0.f;          // 0 standing .. 1 at WalkSpeed (up to 1.25), smoothed
	float StepPhase = 0.f;     // in steps
	float YawRate = 0.f;       // deg/s, smoothed
	bool bHasLast = false;
	float LastYaw = 0.f;
	float SmoothPitch = 0.f;
	float SmoothYaw = 0.f;
};
