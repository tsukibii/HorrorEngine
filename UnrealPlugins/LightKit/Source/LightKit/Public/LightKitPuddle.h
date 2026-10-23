#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "LightKitPuddle.generated.h"

class UDecalComponent;
class UMaterialInstanceDynamic;

/**
 * Wet ground as a decal: one irregular puddle, deep in the middle (dark and mirror-smooth) and damp round its edge
 * (darker, a little glossy). Drop it on a floor or a street, size its box, and drop a few for a wet street. The
 * reflections are the level's own (screen-space, Lumen or the reflection captures), so street lights, windows and
 * passing cars smear across it as you walk: the wet-night look, for the cost of one decal.
 */
UCLASS(meta = (DisplayName = "Light Kit Puddle"))
class LIGHTKIT_API ALightKitPuddle : public AActor
{
	GENERATED_BODY()

public:
	ALightKitPuddle();

	/** cm: X is the depth the decal projects, Y and Z the area. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	FVector Size = FVector(40.f, 300.f, 300.f);

	/** How much of the box is wet (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0", ClampMax = "1"))
	float Coverage = 0.45f;

	/** Metres across the edge's wobbles: smaller is a more ragged edge. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0.05"))
	float Wobble = 0.8f;

	/** How wide the damp edge is (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit", meta = (ClampMin = "0.01", ClampMax = "1"))
	float Edge = 0.15f;

	/** 0 picks one from where it's placed. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Light Kit")
	int32 Seed = 0;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Light Kit|Components")
	TObjectPtr<UDecalComponent> Decal;

	virtual void OnConstruction(const FTransform& Transform) override;

private:
	UPROPERTY(Transient)
	TObjectPtr<UMaterialInstanceDynamic> WetMaterial;
};
