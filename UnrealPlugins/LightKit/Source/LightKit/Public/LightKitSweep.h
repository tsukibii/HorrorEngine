#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LightKitSweep.generated.h"

class USpotLightComponent;

/**
 * A car passing outside at night: a pair of headlights drives from From to To, aimed at Aim, every so often. Through
 * a window its light and the frame's shadows sweep across the ceiling and walls, and its highlight slides over
 * anything glossy (metal, a wet floor, a screen). One moving shadowed spot light per car: cheap, and it makes a
 * still room feel lived in (or watched). Put it outside the window; drag the three points in the viewport.
 */
UCLASS(meta = (DisplayName = "Light Kit Sweep"))
class LIGHTKIT_API ALightKitSweep : public AActor
{
	GENERATED_BODY()

public:
	ALightKitSweep();

	/** Where the car comes from and goes to, relative to the actor (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (MakeEditWidget = "true"))
	FVector From = FVector(0.f, -1500.f, 60.f);

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (MakeEditWidget = "true"))
	FVector To = FVector(0.f, 1500.f, 60.f);

	/** What the headlights point at: the room (relative, cm). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (MakeEditWidget = "true"))
	FVector Aim = FVector(800.f, 0.f, 150.f);

	/** Seconds one pass takes. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0.5"))
	float PassSeconds = 3.5f;

	/** Seconds between passes, picked at random in this range. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0"))
	float MinWait = 12.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0"))
	float MaxWait = 40.f;

	/** Candelas per headlight (a real low beam is about 20000 at its centre). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0"))
	float Intensity = 15000.f;

	/** Halogen 3200 K, LED 5500 K. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "1500", ClampMax = "12000"))
	float Kelvin = 3600.f;

	/** cm between the two headlights. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0"))
	float Spread = 150.f;

	/** Pass only while the Light Kit Sky says Night (or Dusk). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	bool bOnlyInTheDark = true;

	/** Passes start by themselves; off, only TriggerPass starts one (a scripted moment). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	bool bAutomatic = true;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	int32 Seed = 7;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<USpotLightComponent> Left;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<USpotLightComponent> Right;

	/** A car passes now. */
	UFUNCTION(BlueprintCallable, Category = "Light Kit")
	void TriggerPass();

	UFUNCTION(BlueprintPure, Category = "Light Kit")
	bool IsPassing() const { return PassT >= 0.f; }

	virtual void OnConstruction(const FTransform& Transform) override;
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	void Place(float T);
	bool IsDark() const;

	FRandomStream Random;
	float Wait = 0.f;
	float PassT = -1.f;
};
