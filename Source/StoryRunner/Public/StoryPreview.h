// The StoryPreview: plays a game as the desk's Watch does, from the desk's bake (Content/Games/<Game>/Previs/
// preview.json, written by tools/director/bake.js on Generate). Scenes play the recording (the player's camera, the
// cast as the desk's figures, subtitles, the black, the lights' flicker) and stop at their events for a pick; stitches,
// choices and endings are cards with buttons, the way the Watch shows them. The node menu plays from any node.
// It computes nothing of its own: change the story on the desk, Generate, play again. The importer puts one in every
// level (storykit/importer.py, tag `story`). Keys: Tab frees the mouse for the cards (or gives the walk back), N the
// node menu. Docs: docs/UNREAL_FLOW.md §1b.

#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "StoryPreview.generated.h"

class ACameraActor;
class ULightComponent;
class UStaticMeshComponent;
class UMaterialInstanceDynamic;
class UPoseableMeshComponent;
class USkeletalMesh;
class SWidget;
class SVerticalBox;
class FJsonObject;

struct FPvSub { float T0 = 0, T1 = 0; FString En, Ja, Who; };
struct FPvOption { FString Id, Label; };
struct FPvEvent { float T = 0, End = 0; FString Type, Prompt, Default; TArray<FPvOption> Options; };

struct FPvScene
{
	FString Level, Title;
	float Total = 0, Fps = 30, EnterSecs = 0.6f, ExitSecs = 0.6f;
	float LookYaw = 0, LookPitch = 0;            // the cone the player may look round the recorded view in (degrees each side)
	bool bEnterCut = false, bExitCut = false;
	int32 Frames = 0;
	TArray<float> Cam;                          // 10 a frame: position (cm), forward, up, horizontal fov
	TArray<float> Black;
	TArray<FString> Cast;
	TMap<FString, TArray<FVector>> Joints;      // who -> frames x joints; a frame without that figure is all NaN
	TArray<FPvSub> Subs;
	TArray<FPvEvent> Events;
	TMap<FString, TArray<float>> Lights;        // light id -> intensity multiplier a frame
	TMap<FString, TArray<float>> Skin;          // who -> frames x bones x 12: each body bone's skinning matrix
};

struct FPvBody
{
	TWeakObjectPtr<AActor> Actor;
	TObjectPtr<UPoseableMeshComponent> Mesh;
	TArray<FName> Names;                        // Unreal's bones that the bake has, parents first
	TArray<int32> SkinIdx;                      // each one's place in the bake's bone list
	TArray<FMatrix> RefHinv;                    // its reference pose times the inverse of the fitted import axes
	int32 NumSkin = 0;
	float Lin = 100;
};

struct FPvFigure
{
	TWeakObjectPtr<AActor> Actor;
	TArray<TObjectPtr<UStaticMeshComponent>> Limbs;
	TObjectPtr<UStaticMeshComponent> Head, Nose;
};

UCLASS()
class STORYRUNNER_API AStoryPreview : public AActor
{
	GENERATED_BODY()

public:
	AStoryPreview();

	/** The game (Content/Games/<Game>): the importer sets it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Story")
	FString Game;

	/** Start here instead of the story's start (a flow node id). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Story")
	FString StartNode;

	/** Each cast member's body as the desk shows it (imported by Generate from Previs/Body_<who>.glb). A cast
	 *  member without one is drawn as the desk's figure. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Story")
	TMap<FString, TObjectPtr<USkeletalMesh>> Bodies;

	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;
	virtual void Tick(float DeltaSeconds) override;

private:
	enum class EMode : uint8 { Idle, FadeIn, Scene, Event, FadeOut, Card };

	bool Load();
	void BuildUi();
	void Go(const FString& NodeId);
	void PlayFrom(const FString& NodeId);
	void StartScene(const FString& NodeId, const FString& SceneId);
	void EndScene();
	void ShowStitch(const FString& NodeId, const TSharedPtr<FJsonObject>& Node);
	void ShowChoice(const FString& NodeId, const TSharedPtr<FJsonObject>& Node);
	void ShowEnding(const FString& NodeId, const TSharedPtr<FJsonObject>& Node);
	void ShowEvent(const FPvEvent& Ev);
	void Card(const FString& Kind, const FString& Title, const FString& Body, const TArray<TPair<FString, TFunction<void()>>>& Buttons);
	void HideCard();
	void ApplyFrame(float T);
	void ApplyFigures(float T);
	void ShowFigures(bool bShow);
	void SetupBodies();
	void ApplyBodies(float T);
	void SetSceneView(bool bScene);
	void SetMouse(bool bMouse);
	void ToggleMouse();
	void ToggleNodes();
	void Later(TFunction<void()> Fn) { Pending = MoveTemp(Fn); }
	FString NodeTitle(const FString& NodeId) const;
	FString CurrentLevel() const;

	TSharedPtr<FJsonObject> Root, Flow, Stitches;
	TMap<FString, FPvScene> Scenes;
	TArray<FString> JointNames;
	struct FBone { int32 A, B; float R; };
	TArray<FBone> Bones;
	int32 HeadIdx = INDEX_NONE, HeadEndIdx = INDEX_NONE, HeadSideIdx = INDEX_NONE;

	EMode Mode = EMode::Idle;
	FString Node, SceneId;
	float T = 0, PhaseT = 0, TimerLeft = -1;
	FString TimerFail;
	int32 NextEvent = 0;
	TSet<FString> Flags;
	TMap<FString, FString> Results;
	TArray<FString> Trail;
	TFunction<void()> Pending;
	bool bMouse = false, bInScene = false;
	FVector2D UserLook = FVector2D::ZeroVector;  // the player's own look inside the scene's cone (yaw, pitch)
	float LookIdle = 0;
	void UpdateLook(float Dt, const FPvScene& S);

	UPROPERTY(Transient) TObjectPtr<ACameraActor> Camera;
	UPROPERTY(Transient) TObjectPtr<UMaterialInstanceDynamic> FigureMat;
	TMap<FString, FPvFigure> Figures;
	TMap<FString, FPvBody> BodyRigs;
	struct FLightRef { TWeakObjectPtr<ULightComponent> Light; float Base = 0; };
	TMap<FString, FLightRef> LightRefs;

	TSharedPtr<SWidget> Overlay;
	TSharedPtr<SVerticalBox> CardBox, NodeList;
	TSharedPtr<SWidget> CardRoot, NodePanel;
	FText SubEn, SubJa, SubWho, TopLine, TimerText;
	float BlackAlpha = 1;
};
