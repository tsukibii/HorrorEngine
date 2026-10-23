#include "LightKitSweep.h"

#include "Components/SpotLightComponent.h"
#include "LightKitSky.h"

ALightKitSweep::ALightKitSweep()
{
	PrimaryActorTick.bCanEverTick = true;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Static);
	SetRootComponent(Root);

	auto MakeLamp = [this, Root](const TCHAR* Name)
	{
		USpotLightComponent* Lamp = CreateDefaultSubobject<USpotLightComponent>(Name);
		Lamp->SetupAttachment(Root);
		Lamp->SetMobility(EComponentMobility::Movable);
		Lamp->IntensityUnits = ELightUnits::Candelas;
		Lamp->bUseTemperature = true;
		Lamp->InnerConeAngle = 12.f;
		Lamp->OuterConeAngle = 32.f;
		Lamp->AttenuationRadius = 4000.f;
		Lamp->SourceRadius = 8.f;
		return Lamp;
	};
	Left = MakeLamp(TEXT("Left"));
	Right = MakeLamp(TEXT("Right"));
}

void ALightKitSweep::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	for (USpotLightComponent* Lamp : { Left.Get(), Right.Get() })
	{
		Lamp->SetTemperature(Kelvin);
		Lamp->SetIntensity(Intensity);
	}
	// in the editor, show the lamps a third of the way along, aimed, so the setup can be judged
	const UWorld* World = GetWorld();
	Place(World && World->IsGameWorld() ? -1.f : 0.33f);
}

void ALightKitSweep::BeginPlay()
{
	Super::BeginPlay();
	Random.Initialize(Seed);
	Wait = Random.FRandRange(FMath::Min(MinWait, MaxWait) * 0.3f, FMath::Max(MinWait, MaxWait));
	PassT = -1.f;
	Place(-1.f);
}

bool ALightKitSweep::IsDark() const
{
	const ALightKitSky* Sky = ALightKitSky::Find(GetWorld());
	return !Sky || Sky->GetCurrent().SunIntensity < 10000.f; // dusk or darker
}

void ALightKitSweep::TriggerPass()
{
	PassT = 0.f;
}

void ALightKitSweep::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (PassT < 0.f)
	{
		if (!bAutomatic || (bOnlyInTheDark && !IsDark()))
		{
			return;
		}
		Wait -= DeltaSeconds;
		if (Wait > 0.f)
		{
			return;
		}
		PassT = 0.f;
	}

	PassT += DeltaSeconds / FMath::Max(PassSeconds, 0.1f);
	if (PassT >= 1.f)
	{
		PassT = -1.f;
		Wait = Random.FRandRange(FMath::Min(MinWait, MaxWait), FMath::Max(MinWait, MaxWait));
		Place(-1.f);
		return;
	}
	Place(PassT);
}

void ALightKitSweep::Place(float T)
{
	if (T < 0.f)
	{
		Left->SetVisibility(false);
		Right->SetVisibility(false);
		return;
	}
	// eased along the road; it fades in and out at the ends (round a corner, behind a fence)
	const float E = FMath::InterpEaseInOut(0.f, 1.f, T, 1.4f);
	const FTransform& ToWorld = GetActorTransform();
	const FVector Car = ToWorld.TransformPosition(FMath::Lerp(From, To, E));
	const FVector Target = ToWorld.TransformPosition(Aim);
	const FVector Side = FVector::CrossProduct(FVector::UpVector, (Target - Car).GetSafeNormal()).GetSafeNormal();
	const float Fade = FMath::Sin(UE_PI * FMath::Clamp(T, 0.f, 1.f));

	int32 Index = 0;
	for (USpotLightComponent* Lamp : { Left.Get(), Right.Get() })
	{
		const FVector At = Car + Side * (Index == 0 ? -0.5f : 0.5f) * Spread;
		Lamp->SetWorldLocationAndRotation(At, (Target - At).Rotation());
		Lamp->SetIntensity(Intensity * Fade);
		Lamp->SetVisibility(true);
		++Index;
	}
}
