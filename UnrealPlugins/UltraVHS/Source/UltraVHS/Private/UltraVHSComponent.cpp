#include "UltraVHSComponent.h"

#include "Camera/CameraComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "UltraVHSHandheldModifier.h"
#include "UltraVHSSubsystem.h"

UUltraVHSComponent::UUltraVHSComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.bStartWithTickEnabled = true;
	PrimaryComponentTick.TickInterval = 0.25f; // only looks for the camera manager
	bAutoActivate = true;
}

void UUltraVHSComponent::OnRegister()
{
	Super::OnRegister();
	if (UWorld* World = GetWorld())
	{
		if (UUltraVHSSubsystem* Subsystem = World->GetSubsystem<UUltraVHSSubsystem>())
		{
			Subsystem->Register(this);
		}
	}
}

void UUltraVHSComponent::OnUnregister()
{
	if (UWorld* World = GetWorld())
	{
		if (UUltraVHSSubsystem* Subsystem = World->GetSubsystem<UUltraVHSSubsystem>())
		{
			Subsystem->Unregister(this);
		}
	}
	Super::OnUnregister();
}

void UUltraVHSComponent::BeginPlay()
{
	Super::BeginPlay();

	if (bSetMotionBlur)
	{
		if (UCameraComponent* Camera = GetOwner() ? GetOwner()->FindComponentByClass<UCameraComponent>() : nullptr)
		{
			Camera->PostProcessSettings.bOverride_MotionBlurAmount = true;
			Camera->PostProcessSettings.MotionBlurAmount = MotionBlurAmount;
			Camera->PostProcessSettings.bOverride_MotionBlurMax = true;
			Camera->PostProcessSettings.MotionBlurMax = MotionBlurMax;
		}
	}
	AddHandheld();
}

void UUltraVHSComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	RemoveHandheld();
	Super::EndPlay(EndPlayReason);
}

void UUltraVHSComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	// the pawn may be possessed after BeginPlay, or the camera manager replaced
	if (bHandheld && !Modifier)
	{
		AddHandheld();
	}
}

APlayerController* UUltraVHSComponent::FindPlayerController() const
{
	AActor* Owner = GetOwner();
	if (APlayerController* PC = Cast<APlayerController>(Owner))
	{
		return PC;
	}
	if (const APawn* Pawn = Cast<APawn>(Owner))
	{
		return Cast<APlayerController>(Pawn->GetController());
	}
	// on an actor placed in the level: the first local player
	UWorld* World = GetWorld();
	return World ? World->GetFirstPlayerController() : nullptr;
}

void UUltraVHSComponent::AddHandheld()
{
	if (Modifier || !bHandheld)
	{
		return;
	}
	UWorld* World = GetWorld();
	if (!World || !World->IsGameWorld())
	{
		return;
	}
	APlayerController* PC = FindPlayerController();
	if (!PC || !PC->IsLocalController() || !PC->PlayerCameraManager)
	{
		return;
	}
	Modifier = Cast<UUltraVHSHandheldModifier>(PC->PlayerCameraManager->AddNewCameraModifier(UUltraVHSHandheldModifier::StaticClass()));
	if (Modifier)
	{
		Modifier->Source = this;
		ModifierOwner = PC->PlayerCameraManager.Get();
	}
}

void UUltraVHSComponent::RemoveHandheld()
{
	if (Modifier)
	{
		if (APlayerCameraManager* Manager = ModifierOwner.Get())
		{
			Manager->RemoveCameraModifier(Modifier.Get());
		}
		Modifier = nullptr;
		ModifierOwner.Reset();
	}
}

void UUltraVHSComponent::SetVHSEnabled(bool bInEnabled)
{
	bEnabled = bInEnabled;
}

void UUltraVHSComponent::ApplyPreset(EUltraVHSPreset InPreset)
{
	Preset = InPreset;
	if (InPreset != EUltraVHSPreset::Custom)
	{
		Settings = FUltraVHSSettings::FromPreset(InPreset);
	}
}

void UUltraVHSComponent::SetHandheldEnabled(bool bInEnabled)
{
	bHandheld = bInEnabled;
	if (bHandheld)
	{
		AddHandheld();
	}
	else
	{
		RemoveHandheld();
	}
}

void UUltraVHSComponent::TriggerGlitch(float Strength, float Duration)
{
	if (const UWorld* World = GetWorld())
	{
		GlitchStart = World->GetRealTimeSeconds();
		GlitchDuration = FMath::Max(Duration, 0.01f);
		GlitchStrength = FMath::Clamp(Strength, 0.f, 1.f);
	}
}

float UUltraVHSComponent::GetGlitch() const
{
	const UWorld* World = GetWorld();
	if (!World || GlitchStart < 0.0)
	{
		return 0.f;
	}
	const float T = float(World->GetRealTimeSeconds() - GlitchStart) / GlitchDuration;
	if (T < 0.f || T >= 1.f)
	{
		return 0.f;
	}
	return GlitchStrength * FMath::Square(1.f - T);
}

#if WITH_EDITOR
void UUltraVHSComponent::PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent)
{
	Super::PostEditChangeProperty(PropertyChangedEvent);

	const FName Name = PropertyChangedEvent.GetMemberPropertyName();
	if (Name == GET_MEMBER_NAME_CHECKED(UUltraVHSComponent, Preset))
	{
		ApplyPreset(Preset);
	}
	else if (Name == GET_MEMBER_NAME_CHECKED(UUltraVHSComponent, Settings))
	{
		Preset = EUltraVHSPreset::Custom;
	}
}
#endif
