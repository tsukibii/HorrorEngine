#include "LightKitFlicker.h"

#include "Components/LightComponent.h"
#include "Components/PrimitiveComponent.h"
#include "GameFramework/Actor.h"

ULightKitFlicker::ULightKitFlicker()
{
	PrimaryComponentTick.bCanEverTick = true;
	bAutoActivate = true;
}

void ULightKitFlicker::BeginPlay()
{
	Super::BeginPlay();
	Random.Initialize(Seed);
	Lights.Reset();
	BaseIntensity.Reset();
	if (AActor* Owner = GetOwner())
	{
		TArray<ULightComponent*> Found;
		Owner->GetComponents<ULightComponent>(Found);
		for (ULightComponent* L : Found)
		{
			if (L->Mobility == EComponentMobility::Static)
			{
				UE_LOG(LogTemp, Warning, TEXT("Light Kit Flicker: %s is Static, it can't flicker (make it Stationary or Movable)."), *L->GetName());
				continue;
			}
			Lights.Add(L);
			BaseIntensity.Add(L->Intensity);
		}
	}
	NextEvent = Random.FRandRange(0.3f, 2.f) * Interval;
}

void ULightKitFlicker::SetOn(bool bOn)
{
	if (bOn && !bLightsOn && Pattern != ELightKitFlicker::Candle)
	{
		StartupEnd = Time + Random.FRandRange(0.4f, 1.2f); // tubes stutter on
	}
	bLightsOn = bOn;
}

float ULightKitFlicker::Evaluate(float DeltaTime)
{
	Time += DeltaTime;
	if (!bLightsOn)
	{
		return 0.f;
	}
	if (Time < StartupEnd)
	{
		// the starter clicking: off and on at random, a few times
		return Random.FRand() < 0.45f ? 0.05f : Random.FRandRange(0.6f, 1.f);
	}

	float M = 1.f;
	switch (Pattern)
	{
	case ELightKitFlicker::Fluorescent:
	case ELightKitFlicker::Dying:
	{
		const bool bDying = Pattern == ELightKitFlicker::Dying;
		if (Time >= NextEvent && EventEnd < Time)
		{
			EventEnd = Time + (bDying ? Random.FRandRange(0.05f, 0.8f) : Random.FRandRange(0.12f, 0.4f));
			NextEvent = EventEnd + Random.FRandRange(bDying ? 0.1f : 0.5f, 2.f) * Interval * (bDying ? 0.3f : 1.f);
		}
		if (Time < EventEnd)
		{
			M = bDying && Random.FRand() < 0.6f ? 0.f : (Random.FRand() < 0.5f ? 0.15f : 1.f);
		}
		else if (bDying)
		{
			M = 0.75f + 0.1f * FMath::PerlinNoise1D(Time * 3.f); // never quite full
		}
		break;
	}
	case ELightKitFlicker::Candle:
		M = 1.f + 0.14f * FMath::PerlinNoise1D(Time * 7.f) + 0.06f * FMath::PerlinNoise1D(Time * 23.f + 5.f);
		break;
	case ELightKitFlicker::Pulse:
		M = 1.f - 0.5f * (0.5f - 0.5f * FMath::Cos(2.f * UE_PI * Rate * Time));
		break;
	case ELightKitFlicker::Custom:
		if (CustomPattern.Len() > 0)
		{
			const int32 Index = FMath::FloorToInt(Time * Rate) % CustomPattern.Len();
			const TCHAR Ch = FChar::ToLower(CustomPattern[Index]);
			M = FMath::Clamp(float(Ch - TEXT('a')), 0.f, 25.f) / 12.f; // 'm' = 1
		}
		break;
	default:
		break;
	}
	return FMath::Lerp(1.f, M, Amount);
}

void ULightKitFlicker::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	Multiplier = Evaluate(DeltaTime);
	for (int32 i = 0; i < Lights.Num(); ++i)
	{
		if (ULightComponent* L = Lights[i].Get())
		{
			L->SetIntensity(BaseIntensity[i] * Multiplier);
		}
	}
	if (!EmissiveParameter.IsNone())
	{
		if (AActor* Owner = GetOwner())
		{
			TArray<UPrimitiveComponent*> Prims;
			Owner->GetComponents<UPrimitiveComponent>(Prims);
			for (UPrimitiveComponent* P : Prims)
			{
				P->SetScalarParameterValueOnMaterials(EmissiveParameter, Multiplier);
			}
		}
	}
}
