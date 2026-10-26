#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "LightKitFlicker.generated.h"

class ULightComponent;

UENUM(BlueprintType)
enum class ELightKitFlicker : uint8
{
	/** No flicker (SetOn still stutters a fluorescent on). */
	Steady,
	/** A tube: steady, then now and then a stutter of quick drops. */
	Fluorescent,
	/** A failing bulb or tube: drops out often, sometimes for a while. */
	Dying,
	/** A flame: a fast, small, restless wobble. */
	Candle,
	/** A slow breath up and down. */
	Pulse,
	/** Your own: CustomPattern, letters a (off) to m (normal) to z (double), Rate letters a second. */
	Custom,
};

/**
 * Add to any actor with lights (a lamp, a ceiling fitting, a Light Kit Pattern): its lights flicker by a pattern. It
 * scales every light on the actor from the intensity it had at the start, and can drive a scalar parameter on the
 * actor's meshes (the bulb's emissive) in step. The lights must be Movable or Stationary.
 */
UCLASS(ClassGroup = (Lights), meta = (BlueprintSpawnableComponent, DisplayName = "Light Kit Flicker"))
class LIGHTKIT_API ULightKitFlicker : public UActorComponent
{
	GENERATED_BODY()

public:
	ULightKitFlicker();

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit")
	ELightKitFlicker Pattern = ELightKitFlicker::Fluorescent;

	/** How much of the pattern (0 steady, 1 all of it). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit", meta = (ClampMin = "0", ClampMax = "1"))
	float Amount = 1.f;

	/** Seconds between a fluorescent's stutters, or a dying light's drop-outs (picked at random up to twice this). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit", meta = (ClampMin = "0.1"))
	float Interval = 6.f;

	/** Pulse: breaths a second. Custom: letters a second. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit", meta = (ClampMin = "0.01"))
	float Rate = 10.f;

	/** Custom: a (off) .. m (as placed) .. z (double), one letter per 1/Rate s, looping. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit")
	FString CustomPattern = TEXT("mmmmmmmmmmmmmmmmmmmmamammmmmmmmmmmmmmmammmmmmmm");

	/** A scalar parameter on the actor's meshes set to the same multiplier (e.g. "EmissiveStrength"); None for none. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit")
	FName EmissiveParameter = NAME_None;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Light Kit")
	int32 Seed = 1;

	/** Switch the lights on (a fluorescent stutters on) or off. */
	UFUNCTION(BlueprintCallable, Category = "Light Kit")
	void SetOn(bool bOn);

	UFUNCTION(BlueprintPure, Category = "Light Kit")
	bool IsOn() const { return bLightsOn; }

	/** This frame's multiplier on the lights' intensity. */
	UFUNCTION(BlueprintPure, Category = "Light Kit")
	float GetMultiplier() const { return Multiplier; }

	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
	float Evaluate(float DeltaTime);

	UPROPERTY(Transient)
	TArray<TObjectPtr<ULightComponent>> Lights;

	TArray<float> BaseIntensity;
	FRandomStream Random;
	float Time = 0.f;
	float NextEvent = 0.f;   // when the next stutter or drop-out starts
	float EventEnd = -1.f;   // when the current one ends
	float StartupEnd = -1.f; // a fluorescent's stutter on
	float Multiplier = 1.f;
	bool bLightsOn = true;
};
