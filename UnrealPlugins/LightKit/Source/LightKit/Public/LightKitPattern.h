#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LightKitTypes.h"
#include "LightKitPattern.generated.h"

class UMaterialInstanceDynamic;
class USpotLightComponent;

/**
 * Moving light without moving anything: a spot light with one of the kit's light functions. Aim it at the surface.
 *   Caustics  light off water on a ceiling or a wall (by a bath, a pool, a puddle under a lamp)
 *   Leaves    sun (or moon) through swaying trees, through a window onto a floor
 *   Blinds    stripes from venetian blinds
 *   Clouds    cloud shadows passing (the sky does these for its own sun)
 * It adds to what's there (shadows off by default: cheap). With FollowSky its colour and strength follow the sky's sun.
 */
UCLASS(meta = (DisplayName = "Light Kit Pattern"))
class LIGHTKIT_API ALightKitPattern : public AActor
{
	GENERATED_BODY()

public:
	ALightKitPattern();

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	ELightKitPattern Pattern = ELightKitPattern::Caustics;

	/** Candelas, by day (FollowSky scales it with the sun). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0"))
	float Intensity = 2000.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	FLinearColor Color = FLinearColor(0.85f, 0.95f, 1.f, 1.f);

	/** Take the sky's sun colour and scale by its strength (leaves and blinds by daylight, dim at night). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	bool bFollowSky = false;

	/** Metres across one cell, leaf cluster, slat or cloud. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0.01"))
	float Size = 0.6f;

	/** How fast it moves (cells a second, roughly). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0"))
	float Speed = 0.4f;

	/** Leaves: how open the canopy is; blinds: how open the slats are (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0", ClampMax = "1"))
	float Openness = 0.5f;

	/** Blinds: the slats' angle in degrees (0 is horizontal). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	float Angle = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "1", ClampMax = "89"))
	float ConeAngle = 40.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "50"))
	float Reach = 600.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	bool bShadows = false;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<USpotLightComponent> Light;

	UFUNCTION(BlueprintCallable, Category = "Light Kit")
	void Refresh();

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

private:
	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> PatternMaterial;

	ELightKitPattern MaterialFor = ELightKitPattern::None;
};
