#include "LightKitPattern.h"

#include "Components/SpotLightComponent.h"
#include "LightKitSky.h"
#include "Materials/MaterialInstanceDynamic.h"

ALightKitPattern::ALightKitPattern()
{
	PrimaryActorTick.bCanEverTick = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Static);
	SetRootComponent(Root);

	Light = CreateDefaultSubobject<USpotLightComponent>(TEXT("Light"));
	Light->SetupAttachment(Root);
	Light->SetMobility(EComponentMobility::Movable);
	Light->IntensityUnits = ELightUnits::Candelas;
	Light->LightFunctionScale = FVector(100.f); // the pattern in metres
	Light->SetRelativeRotation(FRotator(-90.f, 0.f, 0.f)); // down at the floor by default
}

void ALightKitPattern::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	Refresh();
}

void ALightKitPattern::BeginPlay()
{
	Super::BeginPlay();
	Refresh();
}

void ALightKitPattern::Refresh()
{
	float Strength = Intensity;
	FLinearColor Tint = Color;
	if (bFollowSky)
	{
		if (const ALightKitSky* Sky = ALightKitSky::Find(GetWorld()))
		{
			const FLightKitTimeSettings& S = Sky->GetCurrent();
			Strength *= S.SunIntensity / LightKit::DaySunLux;
			const float Peak = FMath::Max3(S.SunColor.R, S.SunColor.G, S.SunColor.B);
			Tint = Peak > 0.f ? S.SunColor / Peak : FLinearColor::White;
		}
	}
	Light->SetIntensity(Strength);
	Light->SetLightColor(Tint);
	Light->SetOuterConeAngle(ConeAngle);
	Light->SetInnerConeAngle(ConeAngle * 0.6f);
	Light->SetAttenuationRadius(Reach);
	Light->SetCastShadows(bShadows);

	if (MaterialFor != Pattern || (!PatternMaterial && Pattern != ELightKitPattern::None))
	{
		PatternMaterial = nullptr;
		MaterialFor = Pattern;
		if (const TCHAR* Path = LightKit::PatternMaterialPath(Pattern))
		{
			if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, Path))
			{
				PatternMaterial = UMaterialInstanceDynamic::Create(Base, this);
			}
			else
			{
				UE_LOG(LogTemp, Warning, TEXT("Light Kit Pattern: %s isn't made yet; run lightkit_materials.build() in the editor (CLAUDE.md step 2)."), Path);
			}
		}
	}
	if (PatternMaterial)
	{
		PatternMaterial->SetScalarParameterValue(TEXT("Scale"), Size);
		PatternMaterial->SetScalarParameterValue(TEXT("Speed"), Speed);
		PatternMaterial->SetScalarParameterValue(TEXT("Openness"), Openness);
		PatternMaterial->SetScalarParameterValue(TEXT("Angle"), Angle);
	}
	Light->SetLightFunctionMaterial(PatternMaterial.Get());
}
