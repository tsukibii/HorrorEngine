#include "UltraVHSHandheldModifier.h"

#include "Camera/PlayerCameraManager.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "UltraVHSComponent.h"

UUltraVHSHandheldModifier::UUltraVHSHandheldModifier()
{
	AlphaInTime = 0.5f;
	AlphaOutTime = 0.5f;
}

namespace
{
	// two octaves of 1D Perlin noise, about -1..1
	float Wander(float T, float Seed)
	{
		return FMath::PerlinNoise1D(T + Seed) * 0.75f + FMath::PerlinNoise1D(T * 2.31f + Seed * 1.7f) * 0.35f;
	}
}

bool UUltraVHSHandheldModifier::ModifyCamera(float DeltaTime, FMinimalViewInfo& InOutPOV)
{
	Super::ModifyCamera(DeltaTime, InOutPOV);

	const UUltraVHSComponent* Comp = Source.Get();
	if (!Comp || !Comp->IsHandheldActive())
	{
		bHasLast = false;
		return false;
	}
	const FUltraVHSHandheldSettings& S = Comp->Handheld;
	const float Dt = FMath::Clamp(DeltaTime, 0.f, 0.1f);
	const float Amount = S.Intensity * Alpha;
	if (Dt <= 0.f || Amount <= 0.f)
	{
		return false;
	}
	Time += Dt;

	// how much the view target walks (on the ground)
	float Speed = 0.f;
	bool bGrounded = true;
	if (const AActor* Target = CameraOwner ? CameraOwner->GetViewTarget() : nullptr)
	{
		Speed = (float)Target->GetVelocity().Size2D();
		if (const ACharacter* Character = Cast<ACharacter>(Target))
		{
			if (const UCharacterMovementComponent* Movement = Character->GetCharacterMovement())
			{
				bGrounded = Movement->IsMovingOnGround();
			}
		}
	}
	const float WalkTarget = bGrounded ? FMath::Clamp(Speed / FMath::Max(S.WalkSpeed, 1.f), 0.f, 1.25f) : 0.f;
	Walk = FMath::FInterpTo(Walk, WalkTarget, Dt, 4.f);
	StepPhase = FMath::Fmod(StepPhase + Dt * S.StepsPerSecond * FMath::Sqrt(FMath::Max(WalkTarget, 0.25f)), 1000.f);

	// the weight: the view trails the look (pitch and yaw only, so it never rolls on its own)
	const float LookPitch = (float)InOutPOV.Rotation.Pitch;
	const float LookYaw = (float)InOutPOV.Rotation.Yaw;
	const float LookRoll = (float)InOutPOV.Rotation.Roll;
	if (!bHasLast)
	{
		SmoothPitch = LookPitch;
		SmoothYaw = LookYaw;
		LastYaw = LookYaw;
		YawRate = 0.f;
		bHasLast = true;
	}
	if (S.RotationLag > 0.f)
	{
		const float A = 1.f - FMath::Exp(-Dt / S.RotationLag);
		SmoothPitch += FMath::FindDeltaAngleDegrees(SmoothPitch, LookPitch) * A;
		SmoothYaw += FMath::FindDeltaAngleDegrees(SmoothYaw, LookYaw) * A;
	}
	else
	{
		SmoothPitch = LookPitch;
		SmoothYaw = LookYaw;
	}

	// the turn: bank into it
	YawRate = FMath::FInterpTo(YawRate, FMath::FindDeltaAngleDegrees(LastYaw, LookYaw) / Dt, Dt, 6.f);
	LastYaw = LookYaw;
	const float Bank = FMath::Clamp(YawRate * S.TurnRoll, -S.MaxTurnRoll, S.MaxTurnRoll);

	// the drift: the hands' wander and breathing
	const float DriftScale = FMath::Lerp(1.f, S.WalkingDrift, FMath::Min(Walk, 1.f));
	const float DriftT = Time * S.DriftSpeed;
	float Pitch = S.DriftPitch * DriftScale * Wander(DriftT, 11.3f) + S.BreathPitch * FMath::Sin(Time * 2.f * UE_PI * 0.25f);
	float Yaw = S.DriftYaw * DriftScale * Wander(DriftT, 47.9f);
	float Roll = S.DriftRoll * DriftScale * Wander(DriftT, 83.1f) + Bank;

	// the gait: down at each footfall, side to side once per stride
	const float Gait = FMath::Min(Walk, 1.25f);
	const float StepAngle = 2.f * UE_PI * StepPhase;
	const float StrideAngle = UE_PI * StepPhase;
	Pitch += S.BobPitch * Gait * FMath::Cos(StepAngle + 0.6f);
	Yaw += S.BobYaw * Gait * FMath::Sin(StrideAngle + 0.3f);
	Roll += S.BobRoll * Gait * FMath::Sin(StrideAngle);
	const FVector Offset(0.f, S.BobSway * Gait * FMath::Sin(StrideAngle), S.BobHeight * 0.5f * Gait * FMath::Cos(StepAngle));

	const FRotator Base(SmoothPitch, SmoothYaw, LookRoll);
	InOutPOV.Location += Base.RotateVector(Offset * Amount);
	InOutPOV.Rotation = FRotator(Base.Pitch + Pitch * Amount, Base.Yaw + Yaw * Amount, Base.Roll + Roll * Amount);

	return false;
}
