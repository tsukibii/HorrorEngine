#include "UltraVHSSubsystem.h"

#include "CoreGlobals.h"
#include "HAL/IConsoleManager.h"
#include "Misc/CoreMisc.h"
#include "UltraVHSComponent.h"
#include "UltraVHSRenderParams.h"
#include "UltraVHSViewExtension.h"

static TAutoConsoleVariable<int32> CVarUltraVHS(
	TEXT("r.UltraVHS"),
	-1,
	TEXT("-1: UltraVHS components decide (default). 0: off everywhere. 1, 2, 3: on with the Camcorder, WornTape or ")
	TEXT("Nightmare preset, with or without a component (also in the editor's viewport)."),
	ECVF_Default);

static TAutoConsoleVariable<float> CVarUltraVHSGlitch(
	TEXT("r.UltraVHS.Glitch"),
	0.f,
	TEXT("Tape damage added on top of everything, 0..1 (for trying the glitch without a trigger)."),
	ECVF_Default);

namespace UltraVHS
{
	static void ToRenderParams(const FUltraVHSSettings& S, float Glitch, FUltraVHSRenderParams& Out)
	{
		Out.bEnabled = true;
		Out.bCrop4x3 = S.bCrop4x3;
		Out.TapeLines = S.TapeLines;
		Out.Distortion = S.Distortion;
		Out.ChromaticAberration = S.ChromaticAberration;
		Out.Vignette = S.Vignette;
		Out.BlackLevel = S.BlackLevel;
		Out.WhiteLevel = S.WhiteLevel;
		Out.Saturation = S.Saturation;
		Out.LumaBlur = S.LumaBlur;
		Out.Sharpen = S.Sharpen;
		Out.SharpenRadius = S.SharpenRadius;
		Out.ChromaBlur = S.ChromaBlur;
		Out.ChromaShift = S.ChromaShift;
		Out.ChromaVerticalBlend = S.ChromaVerticalBlend;
		Out.Ghosting = S.Ghosting;
		Out.LumaNoise = S.LumaNoise;
		Out.ChromaNoise = S.ChromaNoise;
		Out.TrackingJitter = S.TrackingJitter;
		Out.TrackingError = S.TrackingError;
		Out.HeadSwitch = S.HeadSwitch;
		Out.Dropouts = S.Dropouts;
		Out.Scanlines = S.Scanlines;
		Out.Glitch = FMath::Clamp(Glitch, 0.f, 1.f);
	}
}

bool UUltraVHSSubsystem::ShouldCreateSubsystem(UObject* Outer) const
{
	return !IsRunningDedicatedServer() && Super::ShouldCreateSubsystem(Outer);
}

void UUltraVHSSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	Extension = FSceneViewExtensions::NewExtension<FUltraVHSViewExtension>(GetWorld());
	TWeakObjectPtr<UUltraVHSSubsystem> WeakThis(this);
	Extension->SetProvider([WeakThis](FUltraVHSRenderParams& Out)
	{
		const UUltraVHSSubsystem* Self = WeakThis.Get();
		return Self && Self->BuildRenderParams(Out);
	});
}

void UUltraVHSSubsystem::Deinitialize()
{
	if (Extension.IsValid())
	{
		Extension->SetProvider(nullptr);
		Extension.Reset();
	}
	Components.Reset();
	Super::Deinitialize();
}

void UUltraVHSSubsystem::Register(UUltraVHSComponent* Component)
{
	Components.Remove(Component);
	Components.Add(Component);
}

void UUltraVHSSubsystem::Unregister(UUltraVHSComponent* Component)
{
	Components.Remove(Component);
}

UUltraVHSComponent* UUltraVHSSubsystem::GetActiveComponent() const
{
	UUltraVHSComponent* Best = nullptr;
	for (const TWeakObjectPtr<UUltraVHSComponent>& Weak : Components)
	{
		UUltraVHSComponent* C = Weak.Get();
		if (C && C->bEnabled && (!Best || C->Priority >= Best->Priority))
		{
			Best = C;
		}
	}
	return Best;
}

bool UUltraVHSSubsystem::BuildRenderParams(FUltraVHSRenderParams& Out) const
{
	const int32 Mode = CVarUltraVHS.GetValueOnGameThread();
	if (Mode == 0)
	{
		return false;
	}

	const UUltraVHSComponent* Active = GetActiveComponent();
	FUltraVHSSettings Settings;
	if (Mode > 0)
	{
		Settings = FUltraVHSSettings::FromPreset((EUltraVHSPreset)FMath::Clamp(Mode - 1, 0, 2));
	}
	else if (Active)
	{
		Settings = Active->Settings;
	}
	else
	{
		return false;
	}

	const float Glitch = (Active ? Active->GetGlitch() : 0.f) + CVarUltraVHSGlitch.GetValueOnGameThread();
	UltraVHS::ToRenderParams(Settings, Glitch, Out);
	return true;
}
