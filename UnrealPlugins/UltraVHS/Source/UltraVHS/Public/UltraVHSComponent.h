#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "UltraVHSSettings.h"
#include "UltraVHSComponent.generated.h"

class APlayerCameraManager;
class APlayerController;
class UUltraVHSHandheldModifier;

/**
 * Records the player's view to VHS. Add it to the player's pawn (or character); it shows in the editor's viewport
 * too when it's on an actor placed in the level. The active one (highest Priority) sets the post-process; the
 * handheld camera goes on the player controller's camera manager while playing.
 */
UCLASS(ClassGroup = (Camera), meta = (BlueprintSpawnableComponent, DisplayName = "Ultra VHS"))
class ULTRAVHS_API UUltraVHSComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UUltraVHSComponent();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS")
	bool bEnabled = true;

	/** Picking a preset in the editor copies it into Settings; editing Settings switches to Custom. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS")
	EUltraVHSPreset Preset = EUltraVHSPreset::Camcorder;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UltraVHS")
	FUltraVHSSettings Settings;

	/** With more than one component in the world, the enabled one with the highest Priority is on screen. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UltraVHS")
	int32 Priority = 0;

	/** The handheld camera (drift, gait, turn roll, weight) while playing. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS|Handheld")
	bool bHandheld = true;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UltraVHS|Handheld", meta = (EditCondition = "bHandheld"))
	FUltraVHSHandheldSettings Handheld;

	/** Set the owner's camera's motion blur at BeginPlay (camcorders smear: the reference's turns blur heavily). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS|Camera")
	bool bSetMotionBlur = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS|Camera", meta = (EditCondition = "bSetMotionBlur", ClampMin = "0", ClampMax = "1"))
	float MotionBlurAmount = 0.8f;

	/** Percent of the screen. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS|Camera", meta = (EditCondition = "bSetMotionBlur", ClampMin = "0", ClampMax = "100"))
	float MotionBlurMax = 6.f;

	/**
	 * Night: black records as NightBlackLevel, a cool blue, instead of the preset's warm lift, so a deep-blue night
	 * (Light Kit's Night) stays blue on the tape. Works with every preset; SetNightMode can blend it.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "UltraVHS|Night")
	bool bNightMode = false;

	/** What black records as at night. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "UltraVHS|Night")
	FLinearColor NightBlackLevel = FLinearColor(0.02f, 0.03f, 0.05f, 1.f);

	UFUNCTION(BlueprintCallable, Category = "UltraVHS")
	void SetVHSEnabled(bool bInEnabled);

	/** Night on or off, blended over BlendSeconds (0: at once), e.g. alongside Light Kit Sky's SetTime. */
	UFUNCTION(BlueprintCallable, Category = "UltraVHS|Night")
	void SetNightMode(bool bNight, float BlendSeconds = 0.f);

	/** How much of the night is on right now: 0 day, 1 night, between while blending. */
	UFUNCTION(BlueprintPure, Category = "UltraVHS|Night")
	float GetNight() const;

	UFUNCTION(BlueprintCallable, Category = "UltraVHS")
	void ApplyPreset(EUltraVHSPreset InPreset);

	UFUNCTION(BlueprintCallable, Category = "UltraVHS|Handheld")
	void SetHandheldEnabled(bool bInEnabled);

	/** A moment of tape damage (a scare, a cut, a rewind): Strength 0..1, fading out over Duration seconds. */
	UFUNCTION(BlueprintCallable, Category = "UltraVHS")
	void TriggerGlitch(float Strength = 1.f, float Duration = 0.6f);

	/** The glitch right now, 0..1. */
	UFUNCTION(BlueprintPure, Category = "UltraVHS")
	float GetGlitch() const;

	bool IsHandheldActive() const { return bHandheld; }

	virtual void OnRegister() override;
	virtual void OnUnregister() override;
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;
#if WITH_EDITOR
	virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent) override;
#endif

private:
	APlayerController* FindPlayerController() const;
	void AddHandheld();
	void RemoveHandheld();

	UPROPERTY(Transient)
	TObjectPtr<UUltraVHSHandheldModifier> Modifier;

	TWeakObjectPtr<APlayerCameraManager> ModifierOwner;

	double GlitchStart = -1.0;
	double NightStart = -1.0;   // a blend's start (real time), -1 when none is running
	float NightBlend = 0.f;
	float NightFrom = 0.f;
	float GlitchDuration = 0.f;
	float GlitchStrength = 0.f;
};
