#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "UltraVHSSubsystem.generated.h"

class FUltraVHSViewExtension;
class UUltraVHSComponent;
struct FUltraVHSRenderParams;

/**
 * One per world (game, PIE and the editor's own). Owns the post-process for that world and feeds it the settings of
 * the active UUltraVHSComponent: the enabled one with the highest Priority, the newest on a tie.
 *
 * Console: r.UltraVHS -1 (components decide), 0 (off), 1 Camcorder, 2 WornTape, 3 Nightmare (on without a
 * component, also in the editor's viewport); r.UltraVHS.Glitch 0..1 adds damage on top; r.UltraVHS.Night -1
 * (the component's night mode), 0 day, 1 night.
 */
UCLASS()
class ULTRAVHS_API UUltraVHSSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual bool ShouldCreateSubsystem(UObject* Outer) const override;
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;

	void Register(UUltraVHSComponent* Component);
	void Unregister(UUltraVHSComponent* Component);

	/** The component whose settings are on screen, if any. */
	UFUNCTION(BlueprintPure, Category = "UltraVHS")
	UUltraVHSComponent* GetActiveComponent() const;

	/** Game thread, every frame: what the post-process draws. False draws nothing. */
	bool BuildRenderParams(FUltraVHSRenderParams& Out) const;

private:
	TArray<TWeakObjectPtr<UUltraVHSComponent>> Components;
	TSharedPtr<FUltraVHSViewExtension, ESPMode::ThreadSafe> Extension;
};
