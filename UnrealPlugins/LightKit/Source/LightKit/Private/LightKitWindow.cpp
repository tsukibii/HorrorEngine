#include "LightKitWindow.h"

#include "Components/ArrowComponent.h"
#include "Components/BoxComponent.h"
#include "Components/LightmassPortalComponent.h"
#include "Components/RectLightComponent.h"
#include "Engine/World.h"
#include "LightKitSky.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "ProceduralMeshComponent.h"

ALightKitWindow::ALightKitWindow()
{
	PrimaryActorTick.bCanEverTick = false;

	Opening = CreateDefaultSubobject<UBoxComponent>(TEXT("Opening"));
	Opening->SetMobility(EComponentMobility::Static);
	Opening->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Opening->SetBoxExtent(FVector(2.f, 60.f, 70.f));
	Opening->ShapeColor = FColor(120, 180, 255);
	SetRootComponent(Opening);

	Arrow = CreateDefaultSubobject<UArrowComponent>(TEXT("Arrow"));
	Arrow->SetupAttachment(Opening);
	Arrow->ArrowColor = FColor(120, 180, 255);
	Arrow->bIsScreenSizeScaled = true;

	// rect lights shine along their +X: into the room
	Fill = CreateDefaultSubobject<URectLightComponent>(TEXT("SkyFill"));
	Fill->SetupAttachment(Opening);
	Fill->SetMobility(EComponentMobility::Movable);
	Fill->IntensityUnits = ELightUnits::Candelas;
	Fill->BarnDoorAngle = 88.f;
	Fill->BarnDoorLength = 20.f;

	BounceLight = CreateDefaultSubobject<URectLightComponent>(TEXT("Bounce"));
	BounceLight->SetupAttachment(Opening);
	BounceLight->SetMobility(EComponentMobility::Movable);
	BounceLight->IntensityUnits = ELightUnits::Candelas;
	BounceLight->CastShadows = false;
	BounceLight->SpecularScale = 0.f;
	BounceLight->BarnDoorAngle = 88.f;

	Portal = CreateDefaultSubobject<ULightmassPortalComponent>(TEXT("Portal"));
	Portal->SetupAttachment(Opening);

	Shaft = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Shaft"));
	Shaft->SetupAttachment(Opening);
	Shaft->SetMobility(EComponentMobility::Movable);
	Shaft->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Shaft->SetCastShadow(false);
	Shaft->bUseAsyncCooking = true;
}

void ALightKitWindow::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	Refresh();
}

void ALightKitWindow::BeginPlay()
{
	Super::BeginPlay();
	Refresh();
}

void ALightKitWindow::Refresh()
{
	UWorld* World = GetWorld();
	const ALightKitSky* Sky = ALightKitSky::Find(World);
	const ELightKitTime Fallback = TimeWithoutSky == ELightKitTime::Custom ? ELightKitTime::Day : TimeWithoutSky;
	const FLightKitTimeSettings S = Sky ? Sky->GetCurrent() : FLightKitTimeSettings::FromPreset(Fallback);
	const bool bBaked = Sky && Sky->IsBaked();
	const FVector SunDir = Sky ? Sky->GetSunDirection() : FRotator(-S.SunElevation, S.SunAzimuth, 0.f).Vector();
	const bool bInPlay = World && World->IsGameWorld();

	Opening->SetBoxExtent(FVector(2.f, Width * 0.5f, Height * 0.5f));
	const float AreaM2 = Width * Height / 10000.f;

	// sky fill: the window as an area light with the sky's luminance (cd = cd/m² x m²)
	if (!bInPlay)
	{
		Fill->SetMobility(bBaked ? EComponentMobility::Stationary : EComponentMobility::Movable);
	}
	Fill->SetSourceWidth(Width);
	Fill->SetSourceHeight(Height);
	Fill->SetAttenuationRadius(Reach);
	Fill->SetIntensity(S.WindowLuminance * AreaM2 * FillScale);
	Fill->SetLightColor(S.WindowColor);
	Fill->SetCastShadows(bFillShadows);
	Fill->SetVisibility(bSkyFill && (!bBaked || bFillWhenBaked));

	// the portal's box has a unit extent: its scale is half its size
	Portal->SetRelativeScale3D(FVector(10.f, Width * 0.5f, Height * 0.5f));
	Portal->SetVisibility(bPortal);

	// does the sun come in, and where does its patch land?
	const FVector Inward = GetActorForwardVector();
	const float Enter = (float)FVector::DotProduct(SunDir, Inward);
	const bool bSunIn = Enter > 0.05f && S.SunIntensity > 0.f;
	FHitResult Hit;
	bool bHit = false;
	float Length = 1500.f;
	if (bSunIn && World)
	{
		const FVector Start = GetActorLocation() + Inward * 5.f;
		FCollisionQueryParams Params(SCENE_QUERY_STAT(LightKitWindow), false, this);
		bHit = World->LineTraceSingleByChannel(Hit, Start, Start + SunDir * 3000.f, ECC_Visibility, Params);
		if (bHit)
		{
			Length = (float)Hit.Distance;
		}
	}

	// fake bounce: the patch's light off the floor, coloured by it (L = E albedo / pi, cd = L x patch area)
	const bool bWantBounce = Bounce == ELightKitAuto::On || (Bounce == ELightKitAuto::Auto && !LightKit::IsLumenOn() && !bBaked);
	if (bWantBounce && bHit)
	{
		const float CosI = FMath::Max((float)FVector::DotProduct(-SunDir, Hit.ImpactNormal), 0.f);
		const float Illuminance = S.SunIntensity * CosI * 0.85f; // through the glass
		const float Albedo = FMath::Clamp(FloorColor.GetLuminance(), 0.02f, 0.9f);
		const float PatchM2 = AreaM2 * Enter / FMath::Max(CosI, 0.2f);
		const float Side = FMath::Sqrt(PatchM2) * 100.f;
		const float Peak = FMath::Max3(FloorColor.R, FloorColor.G, FloorColor.B);
		BounceLight->SetWorldLocationAndRotation(Hit.ImpactPoint + Hit.ImpactNormal * 5.f, Hit.ImpactNormal.Rotation());
		BounceLight->SetSourceWidth(Side);
		BounceLight->SetSourceHeight(Side);
		BounceLight->SetAttenuationRadius(Reach * 0.6f);
		BounceLight->SetIntensity(Illuminance * Albedo / UE_PI * PatchM2 * BounceScale);
		BounceLight->SetLightColor(Peak > 0.f ? FloorColor / Peak : FLinearColor::White);
		BounceLight->SetVisibility(true);
	}
	else
	{
		BounceLight->SetVisibility(false);
	}

	if (bShaft && bSunIn && S.ShaftIntensity > 0.f)
	{
		BuildShaft(SunDir, Length, S);
	}
	else
	{
		Shaft->ClearAllMeshSections();
	}
}

void ALightKitWindow::BuildShaft(const FVector& SunDir, float Length, const FLightKitTimeSettings& S)
{
	if (!ShaftMaterial)
	{
		if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, LightKit::ShaftMaterialPath))
		{
			ShaftMaterial = UMaterialInstanceDynamic::Create(Base, this);
		}
	}
	if (!ShaftMaterial)
	{
		Shaft->ClearAllMeshSections();
		return;
	}

	// the window's rectangle pushed along the sun: four open sides, U along the shaft
	const FTransform& ToWorld = GetActorTransform();
	const FVector Centre = GetActorLocation();
	const FVector Right = GetActorRightVector() * (Width * 0.5f);
	const FVector Up = GetActorUpVector() * (Height * 0.5f);
	const FVector Near[4] = { Centre - Right - Up, Centre + Right - Up, Centre + Right + Up, Centre - Right + Up };
	const FVector Axis = Centre + SunDir * (Length * 0.5f);

	TArray<FVector> Vertices;
	TArray<int32> Triangles;
	TArray<FVector> Normals;
	TArray<FVector2D> UVs;
	TArray<FLinearColor> Colors;
	TArray<FProcMeshTangent> Tangents;
	for (int32 Side = 0; Side < 4; ++Side)
	{
		const FVector A = Near[Side];
		const FVector B = Near[(Side + 1) % 4];
		const FVector Corners[4] = { A, B, B + SunDir * Length, A + SunDir * Length };
		const FVector2D CornerUVs[4] = { FVector2D(0, 0), FVector2D(0, 1), FVector2D(1, 1), FVector2D(1, 0) };
		const FVector Mid = (Corners[0] + Corners[1] + Corners[2] + Corners[3]) * 0.25f;
		const FVector Normal = ToWorld.InverseTransformVectorNoScale((Mid - Axis).GetSafeNormal());
		const int32 First = Vertices.Num();
		for (int32 i = 0; i < 4; ++i)
		{
			Vertices.Add(ToWorld.InverseTransformPosition(Corners[i]));
			Normals.Add(Normal);
			UVs.Add(CornerUVs[i]);
			Colors.Add(FLinearColor::White);
		}
		Triangles.Append({ First, First + 1, First + 2, First, First + 2, First + 3 });
	}
	Shaft->CreateMeshSection_LinearColor(0, Vertices, Triangles, Normals, UVs, Colors, Tangents, false);

	const float Peak = FMath::Max3(S.SunColor.R, S.SunColor.G, S.SunColor.B);
	ShaftMaterial->SetVectorParameterValue(TEXT("Color"), Peak > 0.f ? S.SunColor / Peak : FLinearColor::White);
	ShaftMaterial->SetScalarParameterValue(TEXT("Intensity"), S.ShaftIntensity * ShaftScale);
	ShaftMaterial->SetScalarParameterValue(TEXT("Dust"), Dust);
	Shaft->SetMaterial(0, ShaftMaterial.Get());
}
