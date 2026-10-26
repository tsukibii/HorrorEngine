#include "LightKitPuddle.h"

#include "Components/DecalComponent.h"
#include "LightKitTypes.h"
#include "Materials/MaterialInstanceDynamic.h"

ALightKitPuddle::ALightKitPuddle()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SetRootComponent(Root);

	Decal = CreateDefaultSubobject<UDecalComponent>(TEXT("Decal"));
	Decal->SetupAttachment(Root);
	Decal->SetRelativeRotation(FRotator(-90.f, 0.f, 0.f)); // decals project along X: straight down
}

void ALightKitPuddle::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);

	Decal->DecalSize = Size * 0.5f;
	if (!WetMaterial)
	{
		if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, LightKit::WetMaterialPath))
		{
			WetMaterial = UMaterialInstanceDynamic::Create(Base, this);
		}
		else
		{
			UE_LOG(LogTemp, Warning, TEXT("Light Kit Puddle: no wet material yet; run lightkit_materials.build() in the editor (CLAUDE.md step 2)."));
		}
	}
	if (WetMaterial)
	{
		const FVector At = Transform.GetLocation();
		const int32 PickedSeed = Seed != 0 ? Seed : int32(GetTypeHash(FIntVector(FMath::FloorToInt(At.X), FMath::FloorToInt(At.Y), FMath::FloorToInt(At.Z))) % 9973);
		WetMaterial->SetScalarParameterValue(TEXT("Coverage"), Coverage);
		WetMaterial->SetScalarParameterValue(TEXT("Edge"), Edge);
		WetMaterial->SetScalarParameterValue(TEXT("Seed"), float(PickedSeed));
		// the decal's UVs run 0..1 across its box: wobbles per box side
		WetMaterial->SetScalarParameterValue(TEXT("Cells"), float(FMath::Max(Size.Y, Size.Z) / 100.0 / Wobble));
		Decal->SetDecalMaterial(WetMaterial.Get());
	}
	Decal->MarkRenderStateDirty();
}
