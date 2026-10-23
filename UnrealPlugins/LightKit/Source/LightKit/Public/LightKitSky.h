#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LightKitTypes.h"
#include "LightKitSky.generated.h"

class UDirectionalLightComponent;
class UExponentialHeightFogComponent;
class UMaterialInstanceDynamic;
class UPostProcessComponent;
class USkyAtmosphereComponent;
class USkyLightComponent;

/**
 * The whole sky in one actor: the sun (or the moon at night), the sky light, the atmosphere, height fog and the
 * camera's exposure and grade, set by a time of day. Drop one in a level (and take out the level's own sun, sky light,
 * atmosphere and fog). Windows, patterns and sweeps follow it.
 */
UCLASS(meta = (DisplayName = "Light Kit Sky"))
class LIGHTKIT_API ALightKitSky : public AActor
{
	GENERATED_BODY()

public:
	ALightKitSky();

	/** Picking a time copies its preset into Settings; editing Settings switches to Custom. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	ELightKitTime Time = ELightKitTime::Day;

	/** Dynamic (Lumen or none, the time can change in play) or Baked (Lightmass; a bake per time of day). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	ELightKitLighting Lighting = ELightKitLighting::Dynamic;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit")
	FLightKitTimeSettings Settings;

	/** Cloud shadows drifting over everything the sun lights (a light function on the sun; Dynamic or stationary). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sun")
	bool bCloudShadows = false;

	/** Metres across one cloud. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sun", meta = (EditCondition = "bCloudShadows", ClampMin = "1"))
	float CloudSize = 40.f;

	/** Metres a second. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sun", meta = (EditCondition = "bCloudShadows"))
	float CloudSpeed = 1.5f;

	/** Volumetric fog: real light shafts in the air from every shadowed light (about a millisecond on a 3090). Off,
	 * windows' shaft cards do the cheap version. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Fog")
	bool bVolumetricFog = false;

	/** Let the kit set the fog. Off: the fog component is yours. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Fog")
	bool bManageFog = true;

	/** Let the kit set exposure and the grade (an unbound post-process at priority -1, under any volume of yours). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Camera")
	bool bManagePostProcess = true;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UDirectionalLightComponent> Sun;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<USkyLightComponent> SkyLight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<USkyAtmosphereComponent> Atmosphere;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UExponentialHeightFogComponent> Fog;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UPostProcessComponent> Post;

	/** Change the time, at once or over BlendSeconds (Dynamic only: a bake can't change in play). */
	UFUNCTION(BlueprintCallable, Category = "Light Kit")
	void SetTime(ELightKitTime NewTime, float BlendSeconds = 0.f);

	UFUNCTION(BlueprintCallable, Category = "Light Kit")
	void SetSettings(const FLightKitTimeSettings& NewSettings, float BlendSeconds = 0.f);

	/** The way the sun's light travels (down into the world). */
	UFUNCTION(BlueprintPure, Category = "Light Kit")
	FVector GetSunDirection() const;

	/** What's on screen now (mid-blend, between two times). */
	const FLightKitTimeSettings& GetCurrent() const { return Current; }

	bool IsBaked() const { return Lighting == ELightKitLighting::Baked; }

	/** The first Light Kit Sky in the world, if any. */
	static ALightKitSky* Find(const UWorld* World);

	/** Fired when what's on screen changes (at most ten times a second while blending). */
	FSimpleMulticastDelegate OnLightingChanged;

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;
#if WITH_EDITOR
	virtual void PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent) override;
#endif

private:
	void ApplyMobility();
	void Apply(const FLightKitTimeSettings& S);
	void TellFollowers();

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> CloudMaterial;

	FLightKitTimeSettings Current;
	FLightKitTimeSettings BlendFrom;
	FLightKitTimeSettings BlendTo;
	float BlendElapsed = 0.f;
	float BlendDuration = 0.f;
	float SinceTold = 0.f;
};
