#include "LightKitSky.h"

#include "Components/DirectionalLightComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/PostProcessComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/SkyLightComponent.h"
#include "EngineUtils.h"
#include "LightKitPattern.h"
#include "LightKitWindow.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/UObjectHash.h"

ALightKitSky::ALightKitSky()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.bStartWithTickEnabled = false;

	USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Root->SetMobility(EComponentMobility::Static);
	SetRootComponent(Root);

	Sun = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Sun"));
	Sun->SetupAttachment(Root);
	Sun->SetMobility(EComponentMobility::Movable);
	Sun->bAtmosphereSunLight = true;
	Sun->ContactShadowLength = 0.02f; // small things sit on the ground (cheap screen-space shadows)
	Sun->LightFunctionScale = FVector(100.f); // light functions in metres

	SkyLight = CreateDefaultSubobject<USkyLightComponent>(TEXT("SkyLight"));
	SkyLight->SetupAttachment(Root);
	SkyLight->SetMobility(EComponentMobility::Movable);
	SkyLight->bRealTimeCapture = true;

	Atmosphere = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("Atmosphere"));
	Atmosphere->SetupAttachment(Root);

	Fog = CreateDefaultSubobject<UExponentialHeightFogComponent>(TEXT("Fog"));
	Fog->SetupAttachment(Root);

	Post = CreateDefaultSubobject<UPostProcessComponent>(TEXT("Post"));
	Post->SetupAttachment(Root);
	Post->bUnbound = true;
	Post->Priority = -1.f;

	Current = Settings;
}

ALightKitSky* ALightKitSky::Find(const UWorld* World)
{
	if (World)
	{
		for (TActorIterator<ALightKitSky> It(const_cast<UWorld*>(World)); It; ++It)
		{
			return *It;
		}
	}
	return nullptr;
}

FVector ALightKitSky::GetSunDirection() const
{
	return Sun ? Sun->GetForwardVector() : FRotator(-Current.SunElevation, Current.SunAzimuth, 0.f).Vector();
}

void ALightKitSky::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	ApplyMobility();
	Current = Settings;
	Apply(Current);
	TellFollowers();
}

void ALightKitSky::BeginPlay()
{
	Super::BeginPlay();
	Current = Settings;
	Apply(Current);
	TellFollowers();
	TellCamcorder(0.f);
	if (UWorld* World = GetWorld())
	{
		// a player (and its camcorder) spawned after the sky, or respawned, gets the time too
		SpawnedHandle = World->AddOnActorSpawnedHandler(FOnActorSpawned::FDelegate::CreateUObject(this, &ALightKitSky::OnActorSpawned));
	}
}

void ALightKitSky::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UWorld* World = GetWorld())
	{
		World->RemoveOnActorSpawnedHandler(SpawnedHandle);
	}
	Super::EndPlay(EndPlayReason);
}

void ALightKitSky::OnActorSpawned(AActor* Actor)
{
	TellCamcorder(0.f, Actor);
}

void ALightKitSky::TellCamcorder(float BlendSeconds, AActor* OnlyActor) const
{
	UWorld* World = GetWorld();
	if (!bTellCamcorder || Time == ELightKitTime::Custom || !World || !World->IsGameWorld())
	{
		return;
	}
	// UltraVHS's component by name: no module dependency, and nothing to do when the project hasn't got it
	UClass* Camcorder = FindObject<UClass>(nullptr, TEXT("/Script/UltraVHS.UltraVHSComponent"));
	if (!Camcorder)
	{
		return;
	}
	struct FParams { bool bNight; float BlendSeconds; } Params{ Time == ELightKitTime::Night, BlendSeconds };
	ForEachObjectOfClass(Camcorder, [&](UObject* Obj)
	{
		UActorComponent* Comp = Cast<UActorComponent>(Obj);
		if (!Comp || Comp->GetWorld() != World || (OnlyActor && Comp->GetOwner() != OnlyActor))
		{
			return;
		}
		UFunction* Fn = Comp->FindFunction(TEXT("SetNightMode"));
		if (Fn && Fn->ParmsSize == sizeof(FParams))
		{
			Comp->ProcessEvent(Fn, &Params);
		}
	});
}

void ALightKitSky::ApplyMobility()
{
	const bool bBaked = IsBaked();
	const EComponentMobility::Type Mobility = bBaked ? EComponentMobility::Stationary : EComponentMobility::Movable;
	Sun->SetMobility(Mobility);
	SkyLight->SetMobility(Mobility);
	SkyLight->bRealTimeCapture = !bBaked; // live capture needs a movable sky light
}

void ALightKitSky::Apply(const FLightKitTimeSettings& S)
{
	UWorld* World = GetWorld();
	const bool bLocked = IsBaked() && World && World->IsGameWorld(); // a bake can't move its sun in play

	if (!bLocked)
	{
		Sun->SetRelativeRotation(FRotator(-S.SunElevation, S.SunAzimuth, 0.f));
	}
	Sun->SetIntensity(S.SunIntensity);
	Sun->SetLightColor(S.SunColor);
	Sun->LightSourceAngle = S.SunSourceAngle;

	if (bCloudShadows)
	{
		if (!CloudMaterial)
		{
			if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, LightKit::PatternMaterialPath(ELightKitPattern::Clouds)))
			{
				CloudMaterial = UMaterialInstanceDynamic::Create(Base, this);
			}
		}
		if (CloudMaterial)
		{
			CloudMaterial->SetScalarParameterValue(TEXT("Scale"), CloudSize);
			CloudMaterial->SetScalarParameterValue(TEXT("Speed"), CloudSpeed / FMath::Max(CloudSize, 1.f));
			if (Sun->LightFunctionMaterial.Get() != CloudMaterial.Get())
			{
				Sun->SetLightFunctionMaterial(CloudMaterial.Get());
			}
		}
		else
		{
			UE_LOG(LogTemp, Warning, TEXT("Light Kit: no cloud material yet; run lightkit_materials.build() in the editor (CLAUDE.md step 2)."));
		}
	}
	else
	{
		Sun->SetLightFunctionMaterial(nullptr);
	}
	Sun->MarkRenderStateDirty();

	SkyLight->SetIntensity(S.SkyIntensity);
	SkyLight->SetLightColor(S.SkyColor);
	Atmosphere->SetSkyLuminanceFactor(S.SkyGlow);
	if (IsBaked() && !bLocked)
	{
		SkyLight->RecaptureSky();
	}

	if (bManageFog)
	{
		Fog->SetFogDensity(S.FogDensity);
		Fog->SetFogHeightFalloff(S.FogHeightFalloff);
		Fog->SetFogInscatteringColor(S.FogColor);
		Fog->SetVolumetricFog(bVolumetricFog);
	}

	Post->bEnabled = bManagePostProcess;
	if (bManagePostProcess)
	{
		FPostProcessSettings& P = Post->Settings;
		P.bOverride_AutoExposureMethod = true;
		P.AutoExposureMethod = EAutoExposureMethod::AEM_Histogram;
		P.bOverride_AutoExposureMinBrightness = true;
		P.AutoExposureMinBrightness = S.ExposureMin;
		P.bOverride_AutoExposureMaxBrightness = true;
		P.AutoExposureMaxBrightness = S.ExposureMax;
		P.bOverride_AutoExposureBias = true;
		P.AutoExposureBias = S.ExposureBias;
		// a camcorder's iris: it opens and closes over a second or two, not at once
		P.bOverride_AutoExposureSpeedUp = true;
		P.AutoExposureSpeedUp = 1.5f;
		P.bOverride_AutoExposureSpeedDown = true;
		P.AutoExposureSpeedDown = 1.f;
		P.bOverride_WhiteTemp = true;
		P.WhiteTemp = S.WhiteTemp;
		P.bOverride_ColorSaturation = true;
		P.ColorSaturation = FVector4(S.Saturation, S.Saturation, S.Saturation, 1.f);
		P.bOverride_ColorOffsetShadows = true;
		P.ColorOffsetShadows = FVector4(S.ShadowLift.R, S.ShadowLift.G, S.ShadowLift.B, 0.f);
		P.bOverride_BloomIntensity = true;
		P.BloomIntensity = S.Bloom;
	}
}

void ALightKitSky::TellFollowers()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}
	for (TActorIterator<ALightKitWindow> It(World); It; ++It)
	{
		It->Refresh();
	}
	for (TActorIterator<ALightKitPattern> It(World); It; ++It)
	{
		It->Refresh();
	}
	OnLightingChanged.Broadcast();
}

void ALightKitSky::SetTime(ELightKitTime NewTime, float BlendSeconds)
{
	Time = NewTime;
	if (NewTime != ELightKitTime::Custom)
	{
		SetSettings(FLightKitTimeSettings::FromPreset(NewTime), BlendSeconds);
		TellCamcorder(BlendSeconds);
	}
}

void ALightKitSky::SetSettings(const FLightKitTimeSettings& NewSettings, float BlendSeconds)
{
	if (IsBaked() && GetWorld() && GetWorld()->IsGameWorld())
	{
		UE_LOG(LogTemp, Warning, TEXT("Light Kit Sky: a baked sky can't change its sun in play; load another Lighting Scenario. Only the sky's colour, fog and camera change."));
	}
	Settings = NewSettings;
	if (BlendSeconds <= 0.f)
	{
		BlendDuration = 0.f;
		Current = NewSettings;
		Apply(Current);
		TellFollowers();
		SetActorTickEnabled(false);
		return;
	}
	BlendFrom = Current;
	BlendTo = NewSettings;
	BlendElapsed = 0.f;
	BlendDuration = BlendSeconds;
	SinceTold = 0.f;
	SetActorTickEnabled(true);
}

void ALightKitSky::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (BlendDuration <= 0.f)
	{
		SetActorTickEnabled(false);
		return;
	}
	BlendElapsed += DeltaSeconds;
	const float T = FMath::Clamp(BlendElapsed / BlendDuration, 0.f, 1.f);
	Current = FLightKitTimeSettings::Lerp(BlendFrom, BlendTo, FMath::SmoothStep(0.f, 1.f, T));
	Apply(Current);

	SinceTold += DeltaSeconds;
	if (SinceTold >= 0.1f || T >= 1.f)
	{
		SinceTold = 0.f;
		TellFollowers();
	}
	if (T >= 1.f)
	{
		BlendDuration = 0.f;
		SetActorTickEnabled(false);
	}
}

#if WITH_EDITOR
void ALightKitSky::PostEditChangeProperty(FPropertyChangedEvent& PropertyChangedEvent)
{
	const FName Name = PropertyChangedEvent.GetMemberPropertyName();
	if (Name == GET_MEMBER_NAME_CHECKED(ALightKitSky, Time))
	{
		if (Time != ELightKitTime::Custom)
		{
			Settings = FLightKitTimeSettings::FromPreset(Time);
		}
	}
	else if (Name == GET_MEMBER_NAME_CHECKED(ALightKitSky, Settings))
	{
		Time = ELightKitTime::Custom;
	}
	Super::PostEditChangeProperty(PropertyChangedEvent); // reruns the construction script with the new settings
}
#endif
