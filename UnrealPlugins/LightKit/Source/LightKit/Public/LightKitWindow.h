#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LightKitTypes.h"
#include "LightKitWindow.generated.h"

class UArrowComponent;
class UBoxComponent;
class ULightmassPortalComponent;
class UMaterialInstanceDynamic;
class UProceduralMeshComponent;
class URectLightComponent;

/**
 * Drop it in a window opening, the arrow pointing into the room, and size it to the glass. It does what a window does
 * for a room, cheaply:
 *   sky fill   a soft rect light the size of the window: the sky's light coming in (the biggest step to a real room)
 *   portal     a Lightmass portal, so a bake gathers the sky through the window (clean, smooth baked light)
 *   bounce     a fake bounce where the sun's patch lands (light off the floor onto the walls; without Lumen or a bake)
 *   shaft      a light-shaft card from the window to the sun's patch, faded where it meets things (no volumetric fog)
 * The sun's patch itself is the sky's sun through the opening. Everything follows the Light Kit Sky's time.
 */
UCLASS(meta = (DisplayName = "Light Kit Window"))
class LIGHTKIT_API ALightKitWindow : public AActor
{
	GENERATED_BODY()

public:
	ALightKitWindow();

	/** The glass, cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "10"))
	float Width = 120.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "10"))
	float Height = 140.f;

	/** How far into the room the fill reaches, cm. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "100"))
	float Reach = 700.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sky fill")
	bool bSkyFill = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sky fill", meta = (EditCondition = "bSkyFill", ClampMin = "0"))
	float FillScale = 1.f;

	/** Soft shadows from the fill (the room's things shade each other). Off is cheaper and leaks a little. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sky fill", meta = (EditCondition = "bSkyFill"))
	bool bFillShadows = true;

	/** In a baked level the portal brings the sky in, so the fill is off unless this is on. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Sky fill", meta = (EditCondition = "bSkyFill"))
	bool bFillWhenBaked = false;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Bake")
	bool bPortal = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Bounce")
	ELightKitAuto Bounce = ELightKitAuto::Auto;

	/** The colour of what the patch lands on (a wooden floor by default): the bounce takes it. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Bounce")
	FLinearColor FloorColor = FLinearColor(0.45f, 0.3f, 0.2f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Bounce", meta = (ClampMin = "0"))
	float BounceScale = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Shaft")
	bool bShaft = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Shaft", meta = (EditCondition = "bShaft", ClampMin = "0"))
	float ShaftScale = 1.f;

	/** Drifting dust in the shaft (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit|Shaft", meta = (EditCondition = "bShaft", ClampMin = "0", ClampMax = "1"))
	float Dust = 0.5f;

	/** Without a Light Kit Sky in the level, this time. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	ELightKitTime TimeWithoutSky = ELightKitTime::Day;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UBoxComponent> Opening;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UArrowComponent> Arrow;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<URectLightComponent> Fill;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<URectLightComponent> BounceLight;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<ULightmassPortalComponent> Portal;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UProceduralMeshComponent> Shaft;

	/** Re-reads the sky and places everything (the sky calls it when the time changes). */
	UFUNCTION(BlueprintCallable, Category = "Light Kit")
	void Refresh();

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;

private:
	void BuildShaft(const FVector& SunDir, float Length, const FLightKitTimeSettings& S);

	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> ShaftMaterial;
};
