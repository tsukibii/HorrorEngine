#include "StoryPreview.h"

#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Components/LightComponent.h"
#include "Components/PoseableMeshComponent.h"
#include "Engine/SkeletalMesh.h"
#include "Components/StaticMeshComponent.h"
#include "Dom/JsonObject.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "Engine/StaticMesh.h"
#include "EngineUtils.h"
#include "Framework/Application/SlateApplication.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Styling/CoreStyle.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Text/STextBlock.h"

DEFINE_LOG_CATEGORY_STATIC(LogStoryPreview, Log, All);

namespace
{
	FString Str(const TSharedPtr<FJsonObject>& O, const TCHAR* Key)
	{
		FString S;
		if (O.IsValid()) O->TryGetStringField(Key, S);
		return S;
	}

	TSharedPtr<FJsonObject> Obj(const TSharedPtr<FJsonObject>& O, const FString& Key)
	{
		const TSharedPtr<FJsonObject>* Out = nullptr;
		return (O.IsValid() && O->TryGetObjectField(Key, Out)) ? *Out : nullptr;
	}

	const TArray<TSharedPtr<FJsonValue>>* Arr(const TSharedPtr<FJsonObject>& O, const TCHAR* Key)
	{
		const TArray<TSharedPtr<FJsonValue>>* Out = nullptr;
		return (O.IsValid() && O->TryGetArrayField(Key, Out)) ? Out : nullptr;
	}

	FSlateFontInfo Font(int32 Size, const TCHAR* Style = TEXT("Regular")) { return FCoreStyle::GetDefaultFontStyle(Style, Size); }

	const FVector NaNV(NAN, NAN, NAN);

	int32 BodySkinCount(const TSharedPtr<FJsonObject>& Root, const FString& Who)
	{
		const TSharedPtr<FJsonObject> B = Obj(Obj(Root, TEXT("bodies")), Who);
		const TArray<TSharedPtr<FJsonValue>>* Bones = nullptr;
		return (B.IsValid() && B->TryGetArrayField(TEXT("bones"), Bones)) ? Bones->Num() : 0;
	}

	// three.js (x, y up, z south), metres -> Unreal (x, y = three z, z = three y), centimetres; row-vector form
	const FMatrix ThreeToUe(FPlane(100, 0, 0, 0), FPlane(0, 0, 100, 0), FPlane(0, 100, 0, 0), FPlane(0, 0, 0, 1));

	// The affine map (row-vector form, p * M) that best takes points A to points B: least squares, 4 unknowns a column.
	bool FitAffine(const TArray<FVector>& A, const TArray<FVector>& B, FMatrix& Out)
	{
		double N[4][4] = {}, R[4][3] = {};
		for (int32 I = 0; I < A.Num(); ++I)
		{
			const double X[4] = {A[I].X, A[I].Y, A[I].Z, 1.0}, Y[3] = {B[I].X, B[I].Y, B[I].Z};
			for (int32 J = 0; J < 4; ++J)
			{
				for (int32 K = 0; K < 4; ++K) N[J][K] += X[J] * X[K];
				for (int32 D = 0; D < 3; ++D) R[J][D] += X[J] * Y[D];
			}
		}
		for (int32 C = 0; C < 4; ++C)            // Gauss-Jordan with partial pivoting on [N | R]
		{
			int32 Piv = C;
			for (int32 Rr = C + 1; Rr < 4; ++Rr) if (FMath::Abs(N[Rr][C]) > FMath::Abs(N[Piv][C])) Piv = Rr;
			if (FMath::Abs(N[Piv][C]) < 1e-12) return false;
			for (int32 K = 0; K < 4; ++K) Swap(N[C][K], N[Piv][K]);
			for (int32 D = 0; D < 3; ++D) Swap(R[C][D], R[Piv][D]);
			const double Inv = 1.0 / N[C][C];
			for (int32 K = 0; K < 4; ++K) N[C][K] *= Inv;
			for (int32 D = 0; D < 3; ++D) R[C][D] *= Inv;
			for (int32 Rr = 0; Rr < 4; ++Rr)
			{
				if (Rr == C) continue;
				const double F = N[Rr][C];
				for (int32 K = 0; K < 4; ++K) N[Rr][K] -= F * N[C][K];
				for (int32 D = 0; D < 3; ++D) R[Rr][D] -= F * R[C][D];
			}
		}
		Out = FMatrix::Identity;
		for (int32 J = 0; J < 4; ++J)
			for (int32 D = 0; D < 3; ++D) Out.M[J][D] = R[J][D];
		return true;
	}
	bool Valid(const FVector& V) { return !FMath::IsNaN(V.X); }
}

AStoryPreview::AStoryPreview()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
}

bool AStoryPreview::Load()
{
	const FString File = FPaths::ProjectContentDir() / TEXT("Games") / Game / TEXT("Previs") / TEXT("preview.json");
	FString Text;
	if (!FFileHelper::LoadFileToString(Text, *File))
	{
		UE_LOG(LogStoryPreview, Error, TEXT("STORY: no preview at %s: press Generate on the desk"), *File);
		return false;
	}
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		UE_LOG(LogStoryPreview, Error, TEXT("STORY: %s isn't JSON"), *File);
		return false;
	}
	Flow = Obj(Root, TEXT("flow"));
	Stitches = Obj(Root, TEXT("stitches"));

	if (const auto* J = Arr(Root, TEXT("joints")))
		for (const auto& V : *J) JointNames.Add(V->AsString());
	HeadIdx = JointNames.IndexOfByKey(TEXT("head"));
	HeadEndIdx = JointNames.IndexOfByKey(TEXT("head_end"));
	HeadSideIdx = JointNames.IndexOfByKey(TEXT("head_side"));
	if (const auto* B = Arr(Root, TEXT("bones")))
		for (const auto& V : *B)
		{
			const auto& E = V->AsArray();
			const int32 A = JointNames.IndexOfByKey(E[0]->AsString()), C = JointNames.IndexOfByKey(E[1]->AsString());
			if (A != INDEX_NONE && C != INDEX_NONE) Bones.Add({A, C, (float)E[2]->AsNumber()});
		}

	const TSharedPtr<FJsonObject> Sc = Obj(Root, TEXT("scenes"));
	if (Sc.IsValid())
		for (const auto& Pair : Sc->Values)
		{
			const TSharedPtr<FJsonObject> S = Pair.Value->AsObject();
			FPvScene P;
			P.Level = Str(S, TEXT("level"));
			P.Title = Str(S, TEXT("title"));
			P.Total = S->GetNumberField(TEXT("total"));
			P.Fps = S->GetNumberField(TEXT("fps"));
			if (const auto* C = Arr(S, TEXT("cast"))) for (const auto& V : *C) P.Cast.Add(V->AsString());
			if (const auto* Lk = Arr(S, TEXT("look")); Lk && Lk->Num() == 2) { P.LookYaw = (*Lk)[0]->AsNumber(); P.LookPitch = (*Lk)[1]->AsNumber(); }
			const TSharedPtr<FJsonObject> En = Obj(S, TEXT("enter")), Ex = Obj(S, TEXT("exit"));
			P.bEnterCut = Str(En, TEXT("kind")) == TEXT("cut");
			P.bExitCut = Str(Ex, TEXT("kind")) == TEXT("cut");
			double Secs = 0.6;
			if (En.IsValid() && En->TryGetNumberField(TEXT("secs"), Secs)) P.EnterSecs = Secs;
			Secs = 0.6;
			if (Ex.IsValid() && Ex->TryGetNumberField(TEXT("secs"), Secs)) P.ExitSecs = Secs;
			const int32 NJ = JointNames.Num();
			if (const auto* Fr = Arr(S, TEXT("frames")))
			{
				P.Frames = Fr->Num();
				for (const FString& Who : P.Cast) P.Joints.Add(Who).Init(NaNV, P.Frames * NJ);
				for (int32 F = 0; F < P.Frames; ++F)
				{
					const TSharedPtr<FJsonObject> FO = (*Fr)[F]->AsObject();
					const auto* Cam = Arr(FO, TEXT("cam"));
					for (int32 K = 0; K < 10; ++K) P.Cam.Add(Cam && Cam->IsValidIndex(K) ? (float)(*Cam)[K]->AsNumber() : 0.f);
					P.Black.Add(FO->GetNumberField(TEXT("black")));
					const TSharedPtr<FJsonObject> SkinO = Obj(FO, TEXT("skin"));
					for (const FString& Who : P.Cast)
					{
						const int32 NB = BodySkinCount(Root, Who);
						if (NB == 0) continue;
						TArray<float>& Dst = P.Skin.FindOrAdd(Who);
						const TArray<TSharedPtr<FJsonValue>>* SA = nullptr;
						const int32 Start = Dst.Num();
						Dst.AddUninitialized(NB * 12);
						if (SkinO.IsValid() && SkinO->TryGetArrayField(Who, SA) && SA->Num() == NB * 12)
							for (int32 K = 0; K < NB * 12; ++K) Dst[Start + K] = (*SA)[K]->AsNumber();
						else
							for (int32 K = 0; K < NB * 12; ++K) Dst[Start + K] = NAN;
					}
					const TSharedPtr<FJsonObject> Figs = Obj(FO, TEXT("bodies"));
					if (!Figs.IsValid()) continue;
					for (const auto& BP : Figs->Values)
					{
						TArray<FVector>* Dst = P.Joints.Find(FString(*BP.Key));
						if (!Dst) continue;
						const auto& JA = BP.Value->AsArray();
						for (int32 K = 0; K < NJ && K < JA.Num(); ++K)
						{
							if (JA[K]->IsNull()) continue;
							const auto& XYZ = JA[K]->AsArray();
							(*Dst)[F * NJ + K] = FVector(XYZ[0]->AsNumber(), XYZ[1]->AsNumber(), XYZ[2]->AsNumber());
						}
					}
				}
			}
			if (const auto* Su = Arr(S, TEXT("subs")))
				for (const auto& V : *Su)
				{
					const auto O = V->AsObject();
					P.Subs.Add({(float)O->GetNumberField(TEXT("t0")), (float)O->GetNumberField(TEXT("t1")), Str(O, TEXT("en")), Str(O, TEXT("ja")), Str(O, TEXT("who"))});
				}
			if (const auto* Ev = Arr(S, TEXT("events")))
				for (const auto& V : *Ev)
				{
					const auto O = V->AsObject();
					FPvEvent E;
					E.T = O->GetNumberField(TEXT("t"));
					E.End = O->GetNumberField(TEXT("end"));
					E.Type = Str(O, TEXT("type"));
					E.Prompt = Str(O, TEXT("prompt"));
					E.Default = Str(O, TEXT("default"));
					if (const auto* Op = Arr(O, TEXT("options")))
						for (const auto& OV : *Op) E.Options.Add({Str(OV->AsObject(), TEXT("id")), Str(OV->AsObject(), TEXT("label"))});
					P.Events.Add(E);
				}
			const TSharedPtr<FJsonObject> Li = Obj(S, TEXT("lights"));
			if (Li.IsValid())
				for (const auto& LP : Li->Values)
				{
					TArray<float>& Dst = P.Lights.Add(FString(*LP.Key));
					for (const auto& V : LP.Value->AsArray()) Dst.Add(V->AsNumber());
				}
			Scenes.Add(FString(*Pair.Key), MoveTemp(P));
		}
	UE_LOG(LogStoryPreview, Log, TEXT("STORY: preview of %s: %d scenes, %d flow nodes"), *Game, Scenes.Num(), Flow.IsValid() ? Flow->Values.Num() : 0);
	return Flow.IsValid();
}

FString AStoryPreview::CurrentLevel() const
{
	// maps are /Game/Games/<Game>/Maps/L_<level>
	FString Map = UGameplayStatics::GetCurrentLevelName(this, true);
	Map.RemoveFromStart(TEXT("L_"));
	return Map;
}

void AStoryPreview::BeginPlay()
{
	Super::BeginPlay();
	if (Game.IsEmpty() || !Load()) return;

	Camera = GetWorld()->SpawnActor<ACameraActor>(FVector::ZeroVector, FRotator::ZeroRotator);
	Camera->GetCameraComponent()->SetConstraintAspectRatio(false);

	if (UMaterialInterface* Base = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial")))
	{
		FigureMat = UMaterialInstanceDynamic::Create(Base, this);
		FigureMat->SetVectorParameterValue(TEXT("Color"), FLinearColor(FColor(0xc8, 0xc2, 0xb6)));
	}
	UStaticMesh* Cyl = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	auto Part = [this](AActor* Owner, UStaticMesh* Mesh)
	{
		UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(Owner);
		C->SetStaticMesh(Mesh);
		C->SetMobility(EComponentMobility::Movable);
		C->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		if (FigureMat) C->SetMaterial(0, FigureMat);
		C->SetupAttachment(Owner->GetRootComponent());
		C->RegisterComponent();
		return C;
	};
	const TSharedPtr<FJsonObject> Cast = Obj(Root, TEXT("cast"));
	if (Cast.IsValid())
		for (const auto& CP : Cast->Values)
		{
			AActor* A = GetWorld()->SpawnActor<AActor>();
			USceneComponent* R = NewObject<USceneComponent>(A);
			A->SetRootComponent(R);
			R->RegisterComponent();
#if WITH_EDITOR
			A->SetActorLabel(FString::Printf(TEXT("preview_%s"), *CP.Key));
#endif
			FPvFigure F;
			F.Actor = A;
			for (int32 I = 0; I < Bones.Num(); ++I) F.Limbs.Add(Part(A, Cyl));
			F.Head = Part(A, Sphere);
			F.Nose = Part(A, Cube);
			A->SetActorHiddenInGame(true);
			Figures.Add(FString(*CP.Key), F);
		}

	for (TActorIterator<AActor> It(GetWorld()); It; ++It)
		for (const FName& Tag : It->Tags)
		{
			FString S = Tag.ToString();
			if (!S.RemoveFromStart(TEXT("story:"))) continue;
			if (ULightComponent* L = It->FindComponentByClass<ULightComponent>()) LightRefs.Add(S, {L, L->Intensity});
		}

	SetupBodies();
	BuildUi();
	FString From = StartNode;
	if (From.IsEmpty()) From = Str(Root, TEXT("start"));
	Later([this, From]() { PlayFrom(From); });
}

void AStoryPreview::EndPlay(const EEndPlayReason::Type Reason)
{
	if (Overlay.IsValid() && GEngine && GEngine->GameViewport) GEngine->GameViewport->RemoveViewportWidgetContent(Overlay.ToSharedRef());
	Overlay.Reset();
	Super::EndPlay(Reason);
}

void AStoryPreview::BuildUi()
{
	if (!GEngine || !GEngine->GameViewport) return;
	TWeakObjectPtr<AStoryPreview> Self(this);
	const FSlateBrush* White = FCoreStyle::Get().GetBrush("WhiteBrush");
	const FSlateBrush* Panel = FCoreStyle::Get().GetBrush("ToolPanel.GroupBorder");
	auto Btn = [Self](const FString& Label, TFunction<void()> Fn)
	{
		return SNew(SButton).OnClicked_Lambda([Self, Fn]() { if (Self.IsValid()) Self->Later(Fn); return FReply::Handled(); })
			[SNew(STextBlock).Text(FText::FromString(Label)).Font(Font(12))];
	};

	SAssignNew(CardBox, SVerticalBox);
	SAssignNew(NodeList, SVerticalBox);
	CardRoot = SNew(SBox).HAlign(HAlign_Center).VAlign(VAlign_Center).Visibility(EVisibility::Collapsed)
		[SNew(SBorder).BorderImage(Panel).BorderBackgroundColor(FLinearColor(0.02f, 0.02f, 0.025f, 0.92f)).Padding(18)
			[SNew(SBox).MinDesiredWidth(420).MaxDesiredWidth(560)[CardBox.ToSharedRef()]]];
	NodePanel = SNew(SBox).HAlign(HAlign_Left).VAlign(VAlign_Fill).Padding(FMargin(12, 52, 0, 12)).Visibility(EVisibility::Collapsed)
		[SNew(SBorder).BorderImage(Panel).BorderBackgroundColor(FLinearColor(0.02f, 0.02f, 0.025f, 0.92f)).Padding(8)
			[SNew(SBox).WidthOverride(360)[SNew(SScrollBox) + SScrollBox::Slot()[NodeList.ToSharedRef()]]]];

	for (const auto& NP : Flow->Values)
	{
		const FString Id = FString(*NP.Key), Type = Str(NP.Value->AsObject(), TEXT("type"));
		NodeList->AddSlot().AutoHeight().Padding(2)
			[SNew(SButton).OnClicked_Lambda([Self, Id]() { if (Self.IsValid()) Self->Later([Self, Id]() { Self->ToggleNodes(); Self->PlayFrom(Id); }); return FReply::Handled(); })
				[SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("%s \u00B7 %s \u00B7 %s"), *Type, *Id, *NodeTitle(Id)))).Font(Font(11))]];
	}

	Overlay = SNew(SOverlay)
		+ SOverlay::Slot()[SNew(SImage).Image(White).Visibility(EVisibility::HitTestInvisible)
			.ColorAndOpacity_Lambda([Self]() { return FLinearColor(0, 0, 0, Self.IsValid() ? Self->BlackAlpha : 0.f); })]
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Bottom).Padding(FMargin(40, 0, 40, 48))
			[SNew(SVerticalBox).Visibility(EVisibility::HitTestInvisible)
				+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)[SNew(STextBlock).Font(Font(11)).ColorAndOpacity(FLinearColor(0.7f, 0.7f, 0.7f))
					.Text_Lambda([Self]() { return Self.IsValid() ? Self->SubWho : FText(); })]
				+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)[SNew(STextBlock).Font(Font(16)).ShadowOffset(FVector2D(1, 1))
					.Text_Lambda([Self]() { return Self.IsValid() ? Self->SubJa : FText(); })]
				+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Center)[SNew(STextBlock).Font(Font(20)).ShadowOffset(FVector2D(1, 1))
					.Text_Lambda([Self]() { return Self.IsValid() ? Self->SubEn : FText(); })]]
		+ SOverlay::Slot().HAlign(HAlign_Left).VAlign(VAlign_Top).Padding(12)
			[SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(2)[Btn(TEXT("Nodes (N)"), [Self]() { Self->ToggleNodes(); })]
				+ SHorizontalBox::Slot().AutoWidth().Padding(2)[Btn(TEXT("Play from the start"), [Self]() { Self->PlayFrom(Str(Self->Root, TEXT("start"))); })]
				+ SHorizontalBox::Slot().AutoWidth().Padding(2)[Btn(TEXT("Walk (Tab)"), [Self]() { Self->SetMouse(false); })]
				+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(10, 0)[SNew(STextBlock).Font(Font(11)).ColorAndOpacity(FLinearColor(0.75f, 0.75f, 0.75f))
					.Text_Lambda([Self]() { return Self.IsValid() ? Self->TopLine : FText(); })]]
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Top).Padding(16)
			[SNew(STextBlock).Font(Font(22, TEXT("Bold"))).ColorAndOpacity(FLinearColor(0.9f, 0.3f, 0.25f))
				.Text_Lambda([Self]() { return Self.IsValid() ? Self->TimerText : FText(); })]
		+ SOverlay::Slot()[CardRoot.ToSharedRef()]
		+ SOverlay::Slot()[NodePanel.ToSharedRef()];
	GEngine->GameViewport->AddViewportWidgetContent(Overlay.ToSharedRef(), 50);

	if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
	{
		EnableInput(PC);
		InputComponent->BindKey(EKeys::Tab, IE_Pressed, this, &AStoryPreview::ToggleMouse);
		InputComponent->BindKey(EKeys::N, IE_Pressed, this, &AStoryPreview::ToggleNodes);
	}
}

FString AStoryPreview::NodeTitle(const FString& NodeId) const
{
	const TSharedPtr<FJsonObject> N = Obj(Flow, NodeId);
	if (!N.IsValid()) return NodeId;
	const FString Type = Str(N, TEXT("type")), Ref = Str(N, TEXT("ref"));
	if (Type == TEXT("scene") && Scenes.Contains(Ref) && !Scenes[Ref].Title.IsEmpty()) return Scenes[Ref].Title;
	if (Type == TEXT("stitch")) { const FString T2 = Str(Obj(Stitches, Ref), TEXT("title")); if (!T2.IsEmpty()) return T2; }
	FString T3 = Str(N, TEXT("title"));
	if (T3.IsEmpty()) T3 = Str(N, TEXT("prompt"));
	return T3.IsEmpty() ? NodeId : T3;
}

void AStoryPreview::SetMouse(bool bOn)
{
	APlayerController* PC = GetWorld()->GetFirstPlayerController();
	if (!PC) return;
	bMouse = bOn;
	PC->SetShowMouseCursor(bOn);
	PC->ResetIgnoreLookInput();
	if (bOn)
	{
		FInputModeGameAndUI M;
		M.SetHideCursorDuringCapture(false);
		M.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		PC->SetInputMode(M);
		PC->SetIgnoreLookInput(true);
	}
	else
	{
		PC->SetInputMode(FInputModeGameOnly());
		FSlateApplication::Get().SetAllUserFocusToGameViewport();
		if (bInScene) PC->SetIgnoreLookInput(true);      // the mouse looks round the scene's cone (UpdateLook), not the hidden pawn
	}
}

void AStoryPreview::ToggleMouse() { SetMouse(!bMouse); }

void AStoryPreview::ToggleNodes()
{
	if (!NodePanel.IsValid()) return;
	const bool bShow = NodePanel->GetVisibility() != EVisibility::Visible;
	NodePanel->SetVisibility(bShow ? EVisibility::Visible : EVisibility::Collapsed);
	if (bShow) SetMouse(true);
}

void AStoryPreview::SetSceneView(bool bScene)
{
	APlayerController* PC = GetWorld()->GetFirstPlayerController();
	if (!PC) return;
	APawn* Pawn = PC->GetPawn();
	PC->ResetIgnoreMoveInput();
	bInScene = bScene;
	if (bScene)
	{
		PC->SetViewTarget(Camera);
		PC->SetIgnoreMoveInput(true);
		if (Pawn) Pawn->SetActorHiddenInGame(true);       // the template's body would show from the scene camera
	}
	else
	{
		if (Pawn) { Pawn->SetActorHiddenInGame(false); PC->SetViewTarget(Pawn); }
		ShowFigures(false);
	}
}

void AStoryPreview::Card(const FString& Kind, const FString& Title, const FString& Body, const TArray<TPair<FString, TFunction<void()>>>& Buttons)
{
	if (!CardBox.IsValid()) return;
	TWeakObjectPtr<AStoryPreview> Self(this);
	CardBox->ClearChildren();
	CardBox->AddSlot().AutoHeight()[SNew(STextBlock).Text(FText::FromString(Kind)).Font(Font(10)).ColorAndOpacity(FLinearColor(0.6f, 0.6f, 0.6f))];
	CardBox->AddSlot().AutoHeight().Padding(0, 4)[SNew(STextBlock).Text(FText::FromString(Title)).Font(Font(20, TEXT("Bold"))).AutoWrapText(true)];
	if (!Body.IsEmpty()) CardBox->AddSlot().AutoHeight().Padding(0, 4)[SNew(STextBlock).Text(FText::FromString(Body)).Font(Font(13)).AutoWrapText(true)];
	for (const auto& B : Buttons)
	{
		TFunction<void()> Fn = B.Value;
		CardBox->AddSlot().AutoHeight().Padding(0, 4)
			[SNew(SButton).HAlign(HAlign_Center).OnClicked_Lambda([Self, Fn]() { if (Self.IsValid()) Self->Later([Self, Fn]() { Self->HideCard(); Fn(); }); return FReply::Handled(); })
				[SNew(STextBlock).Text(FText::FromString(B.Key)).Font(Font(14))]];
	}
	CardRoot->SetVisibility(EVisibility::Visible);
	SetMouse(true);
}

void AStoryPreview::HideCard()
{
	if (CardRoot.IsValid()) CardRoot->SetVisibility(EVisibility::Collapsed);
	TimerLeft = -1;
	TimerText = FText();
}

void AStoryPreview::PlayFrom(const FString& NodeId)
{
	Flags.Reset();
	Results.Reset();
	Trail.Reset();
	HideCard();
	Go(NodeId);
}

void AStoryPreview::Go(const FString& NodeId)
{
	HideCard();
	SubEn = SubJa = SubWho = FText();
	Node = NodeId;
	const TSharedPtr<FJsonObject> N = Obj(Flow, NodeId);
	if (!N.IsValid())
	{
		Mode = EMode::Card;
		SetSceneView(false);
		Card(TEXT("THE END OF THE FLOW"), NodeId.IsEmpty() ? TEXT("(no next node)") : NodeId, TEXT(""),
			{{TEXT("Play from the start"), [this]() { PlayFrom(Str(Root, TEXT("start"))); }}});
		return;
	}
	Trail.Add(NodeId);
	TopLine = FText::FromString(FString::Join(Trail, TEXT(" \u203A ")).Right(140));
	const FString Type = Str(N, TEXT("type"));
	if (Type == TEXT("scene")) StartScene(NodeId, Str(N, TEXT("ref")));
	else if (Type == TEXT("stitch")) ShowStitch(NodeId, N);
	else if (Type == TEXT("choice")) ShowChoice(NodeId, N);
	else ShowEnding(NodeId, N);
}

void AStoryPreview::StartScene(const FString& NodeId, const FString& Sid)
{
	const FPvScene* S = Scenes.Find(Sid);
	const FString Next = Str(Obj(Flow, NodeId), TEXT("next"));
	if (!S)
	{
		Mode = EMode::Card;
		Card(TEXT("SCENE"), Sid, TEXT("Not in the bake: press Generate on the desk."), {{TEXT("Next \u2192"), [this, Next]() { Go(Next); }}});
		return;
	}
	if (!S->Level.IsEmpty() && S->Level != CurrentLevel())
	{
		Mode = EMode::Card;
		Card(TEXT("SCENE \u00B7 ANOTHER LEVEL"), S->Title, FString::Printf(TEXT("This scene plays in level %s (map L_%s); this map is L_%s."), *S->Level, *S->Level, *CurrentLevel()),
			{{TEXT("Skip it \u2192"), [this, Next]() { Go(Next); }}});
		return;
	}
	SceneId = Sid;
	T = 0;
	PhaseT = 0;
	NextEvent = 0;
	SetSceneView(true);
	SetMouse(false);                                         // the mouse looks round, inside the scene's cone, as on the desk
	UserLook = FVector2D::ZeroVector;
	LookIdle = 0;
	ShowFigures(true);
	ApplyFrame(0);
	Mode = S->bEnterCut ? EMode::Scene : EMode::FadeIn;
	BlackAlpha = S->bEnterCut ? 0.f : 1.f;
}

void AStoryPreview::EndScene()
{
	const FString Next = Str(Obj(Flow, Node), TEXT("next"));
	SubEn = SubJa = SubWho = FText();
	Go(Next);
}

void AStoryPreview::ShowEvent(const FPvEvent& Ev)
{
	Mode = EMode::Event;
	TArray<TPair<FString, TFunction<void()>>> Buttons;
	const FString NodeId = Node;
	const float End = Ev.End;
	for (const FPvOption& O : Ev.Options)
	{
		const FString Id = O.Id;
		Buttons.Add({O.Label.Replace(TEXT("_"), TEXT(" ")), [this, NodeId, Id, End]() { Results.Add(NodeId, Id); T = End; Mode = EMode::Scene; SetMouse(false); }});
	}
	const FString Kind = FString::Printf(TEXT("EVENT \u00B7 %s \u00B7 %.0f s%s"), *Ev.Type, Ev.End - Ev.T, Ev.Default.IsEmpty() ? TEXT("") : *FString::Printf(TEXT(" \u00B7 on time out: %s"), *Ev.Default));
	Card(Kind, Ev.Prompt.IsEmpty() ? Ev.Type : Ev.Prompt, TEXT("How did it go?"), Buttons);
}

void AStoryPreview::ShowStitch(const FString& NodeId, const TSharedPtr<FJsonObject>& N)
{
	Mode = EMode::Card;
	BlackAlpha = 0;
	SetSceneView(false);
	const TSharedPtr<FJsonObject> St = Obj(Stitches, Str(N, TEXT("ref")));
	const FString Next = Str(N, TEXT("next"));
	if (const auto* Fl = Arr(St, TEXT("flags"))) for (const auto& V : *Fl) Flags.Add(V->AsString());
	TArray<TPair<FString, TFunction<void()>>> Buttons;
	const TSharedPtr<FJsonObject> Play = Obj(St, TEXT("play"));
	FString Kind = TEXT("PLAYER TASK"), Body = Str(St, TEXT("goal"));
	if (Play.IsValid())
	{
		Kind = FString::Printf(TEXT("GAMEPLAY \u00B7 %s \u00B7 %.0f s"), *Str(Play, TEXT("type")), Play->GetNumberField(TEXT("secs")));
		Body = Str(Play, TEXT("rule"));
		if (const auto* Rs = Arr(Play, TEXT("results")))
			for (const auto& V : *Rs)
			{
				const FString R = V->AsString();
				Buttons.Add({R.Replace(TEXT("_"), TEXT(" ")), [this, NodeId, R, Next]() { Results.Add(NodeId, R); Go(Next); }});
			}
	}
	else
		Buttons.Add({TEXT("Task done \u2192"), [this, Next]() { Go(Next); }});
	if (const auto* Its = Arr(St, TEXT("interrupts")))
		for (const auto& V : *Its)
		{
			const FString To = Str(V->AsObject(), TEXT("to"));
			Buttons.Add({TEXT("\u2620 ") + Str(V->AsObject(), TEXT("label")), [this, To]() { Go(To); }});
		}
	Card(Kind, Str(St, TEXT("title")), Body + TEXT("\n\nWalk the level as the player (Tab gives the walk back; Tab again for the mouse)."), Buttons);
	const TSharedPtr<FJsonObject> Timer = Obj(St, TEXT("timer"));
	if (Timer.IsValid())
	{
		TimerLeft = Timer->GetNumberField(TEXT("secs"));
		TimerFail = Str(Timer, TEXT("fail"));
	}
	SetMouse(false);                                         // a task is played: walk first, Tab for the card
}

void AStoryPreview::ShowChoice(const FString& NodeId, const TSharedPtr<FJsonObject>& N)
{
	const FString By = Str(N, TEXT("by"));
	const auto* Opts = Arr(N, TEXT("options"));
	if (!Opts || Opts->Num() == 0) { Go(Str(N, TEXT("next"))); return; }
	if (By == TEXT("result"))
	{
		const FString* R = Results.Find(Str(N, TEXT("of")));
		if (R)
			for (const auto& V : *Opts)
				if (Str(V->AsObject(), TEXT("result")) == *R) { Go(Str(V->AsObject(), TEXT("to"))); return; }
	}
	if (By == TEXT("flag"))
	{
		for (const auto& V : *Opts)
		{
			const auto* If = Arr(V->AsObject(), TEXT("if"));
			bool bAll = true;
			if (If)
				for (const auto& F : *If)
				{
					FString Name = F->AsString();
					const bool bNot = Name.RemoveFromStart(TEXT("!"));
					bAll &= (Flags.Contains(Name) != bNot);
				}
			if (bAll) { Go(Str(V->AsObject(), TEXT("to"))); return; }
		}
	}
	// by act, karma, count, or a result not yet known: the player (you) picks
	Mode = EMode::Card;
	BlackAlpha = 0.3f;
	TArray<TPair<FString, TFunction<void()>>> Buttons;
	for (const auto& V : *Opts)
	{
		const auto O = V->AsObject();
		const FString To = Str(O, TEXT("to"));
		FString Label = Str(O, TEXT("label"));
		if (Label.IsEmpty()) Label = Str(O, TEXT("result"));
		if (Label.IsEmpty()) Label = To;
		Buttons.Add({Label, [this, To]() { Go(To); }});
	}
	const FString Kind = By == TEXT("act") ? TEXT("THE PLAYER DECIDES (by acting)") : FString::Printf(TEXT("CHOICE \u00B7 by %s"), *By);
	Card(Kind, Str(N, TEXT("prompt")).IsEmpty() ? NodeId : Str(N, TEXT("prompt")), TEXT(""), Buttons);
}

void AStoryPreview::ShowEnding(const FString& NodeId, const TSharedPtr<FJsonObject>& N)
{
	Mode = EMode::Card;
	SetSceneView(false);
	BlackAlpha = 0.7f;
	const FString Kind = Str(N, TEXT("kind"));
	TArray<TPair<FString, TFunction<void()>>> Buttons;
	const FString Retry = Str(N, TEXT("retry"));
	if (!Retry.IsEmpty()) Buttons.Add({TEXT("Return to: ") + NodeTitle(Retry), [this, Retry]() { Go(Retry); }});
	Buttons.Add({TEXT("Play from the start"), [this]() { PlayFrom(Str(Root, TEXT("start"))); }});
	Buttons.Add({TEXT("Nodes"), [this]() { ToggleNodes(); }});
	Card(Kind == TEXT("death") ? TEXT("YOU DIED") : TEXT("ENDING \u00B7 ") + Kind, NodeTitle(NodeId), FString::Join(Trail, TEXT(" \u203A ")), Buttons);
}

void AStoryPreview::ShowFigures(bool bShow)
{
	for (auto& FP : Figures)
		if (FP.Value.Actor.IsValid()) FP.Value.Actor->SetActorHiddenInGame(!bShow);
	for (auto& BP : BodyRigs)
		if (BP.Value.Actor.IsValid()) BP.Value.Actor->SetActorHiddenInGame(!bShow);
}

void AStoryPreview::SetupBodies()
{
	const TSharedPtr<FJsonObject> BodiesO = Obj(Root, TEXT("bodies"));
	for (const auto& BP : Bodies)
	{
		USkeletalMesh* Mesh = BP.Value;
		const TSharedPtr<FJsonObject> Info = Obj(BodiesO, BP.Key);
		const auto* BoneArr = Arr(Info, TEXT("bones"));
		const auto* BindArr = Arr(Info, TEXT("bind"));
		if (!Mesh || !BoneArr || !BindArr) continue;
		AActor* A = GetWorld()->SpawnActor<AActor>();
		USceneComponent* R = NewObject<USceneComponent>(A);
		A->SetRootComponent(R);
		R->RegisterComponent();
#if WITH_EDITOR
		A->SetActorLabel(FString::Printf(TEXT("preview_body_%s"), *BP.Key));
#endif
		UPoseableMeshComponent* PM = NewObject<UPoseableMeshComponent>(A);
		PM->SetSkinnedAssetAndUpdate(Mesh);
		PM->SetupAttachment(R);
		PM->SetBoundsScale(4.f);                   // posed far from its reference pose: don't cull by the old bounds
		PM->RegisterComponent();

		TMap<FString, int32> SkinIndex;
		for (int32 I = 0; I < BoneArr->Num(); ++I) SkinIndex.Add((*BoneArr)[I]->AsString(), I);
		FPvBody Body;
		Body.Actor = A;
		Body.Mesh = PM;
		Body.NumSkin = BoneArr->Num();
		double Lin = 100;
		if (Info->TryGetNumberField(TEXT("skin_lin"), Lin)) Body.Lin = Lin;
		TArray<FVector> Bind, Ref;
		TArray<FMatrix> RefM;
		const int32 NumUe = PM->GetNumBones();
		for (int32 B = 0; B < NumUe; ++B)               // Unreal's bone order: parents first
		{
			const FName Name = PM->GetBoneName(B);
			const int32* Si = SkinIndex.Find(Name.ToString());
			if (!Si) continue;
			const FTransform RefT = PM->GetBoneTransformByName(Name, EBoneSpaces::ComponentSpace);
			Body.Names.Add(Name);
			Body.SkinIdx.Add(*Si);
			RefM.Add(RefT.ToMatrixWithScale());
			Ref.Add(RefT.GetLocation());
			Bind.Add(FVector((*BindArr)[*Si * 3]->AsNumber(), (*BindArr)[*Si * 3 + 1]->AsNumber(), (*BindArr)[*Si * 3 + 2]->AsNumber()));
		}
		FMatrix H;
		if (Body.Names.Num() < 4 || !FitAffine(Bind, Ref, H))
		{
			UE_LOG(LogStoryPreview, Warning, TEXT("STORY: %s's body: only %d of its bones match the bake; drawn as the figure"), *BP.Key, Body.Names.Num());
			A->Destroy();
			continue;
		}
		double Err = 0;
		for (int32 I = 0; I < Bind.Num(); ++I) Err = FMath::Max(Err, (H.TransformPosition(Bind[I]) - Ref[I]).Size());
		const FMatrix Hinv = H.Inverse();
		for (const FMatrix& M : RefM) Body.RefHinv.Add(M * Hinv);
		UE_LOG(LogStoryPreview, Log, TEXT("STORY: %s's body: %d of %d bones driven, import axes fitted to %.2f cm"), *BP.Key, Body.Names.Num(), NumUe, Err);
		A->SetActorHiddenInGame(true);
		BodyRigs.Add(BP.Key, MoveTemp(Body));
	}
}

void AStoryPreview::ApplyBodies(float Time)
{
	const FPvScene* S = Scenes.Find(SceneId);
	if (!S || S->Frames == 0) return;
	const float FF = FMath::Clamp(Time * S->Fps, 0.f, (float)(S->Frames - 1));
	const int32 F0 = FMath::FloorToInt(FF), F1 = FMath::Min(F0 + 1, S->Frames - 1);
	const float U = FF - F0;
	for (auto& BP : BodyRigs)
	{
		FPvBody& B = BP.Value;
		const TArray<float>* Sk = S->Skin.Find(BP.Key);
		const bool bHere = Sk && Sk->Num() >= S->Frames * B.NumSkin * 12 && !FMath::IsNaN((*Sk)[F0 * B.NumSkin * 12]);
		if (B.Actor.IsValid()) B.Actor->SetActorHiddenInGame(!bHere);
		if (!bHere) continue;
		auto Bone = [&](int32 F, int32 Si)
		{
			const float* E = Sk->GetData() + (F * B.NumSkin + Si) * 12;
			const float L = 1.f / B.Lin;
			const FMatrix Sm(FPlane(E[0] * L, E[1] * L, E[2] * L, 0), FPlane(E[3] * L, E[4] * L, E[5] * L, 0),
			                 FPlane(E[6] * L, E[7] * L, E[8] * L, 0), FPlane(E[9], E[10], E[11], 1));
			return Sm;
		};
		for (int32 K = 0; K < B.Names.Num(); ++K)
		{
			const FTransform T0(B.RefHinv[K] * Bone(F0, B.SkinIdx[K]) * ThreeToUe);
			FTransform Tm = T0;
			if (U > 0.001f && F1 != F0 && !FMath::IsNaN((*Sk)[F1 * B.NumSkin * 12]))
				Tm.Blend(T0, FTransform(B.RefHinv[K] * Bone(F1, B.SkinIdx[K]) * ThreeToUe), U);
			B.Mesh->SetBoneTransformByName(B.Names[K], Tm, EBoneSpaces::ComponentSpace);
		}
	}
}

void AStoryPreview::ApplyFigures(float Time)
{
	const FPvScene* S = Scenes.Find(SceneId);
	if (!S || S->Frames == 0) return;
	const float FF = FMath::Clamp(Time * S->Fps, 0.f, (float)(S->Frames - 1));
	const int32 F0 = FMath::FloorToInt(FF), F1 = FMath::Min(F0 + 1, S->Frames - 1);
	const float U = FF - F0;
	const int32 NJ = JointNames.Num();
	for (auto& FP : Figures)
	{
		AActor* A = FP.Value.Actor.Get();
		if (!A) continue;
		if (BodyRigs.Contains(FP.Key)) { A->SetActorHiddenInGame(true); continue; }     // the real body stands in
		const TArray<FVector>* J = S->Joints.Find(FP.Key);
		const bool bHere = J && Valid((*J)[F0 * NJ + FMath::Max(HeadIdx, 0)]);
		A->SetActorHiddenInGame(!bHere);
		if (!bHere) continue;
		auto At = [&](int32 K)
		{
			const FVector P0 = (*J)[F0 * NJ + K], P1 = (*J)[F1 * NJ + K];
			return Valid(P1) ? FMath::Lerp(P0, P1, U) : P0;
		};
		for (int32 I = 0; I < Bones.Num(); ++I)
		{
			UStaticMeshComponent* C = FP.Value.Limbs[I];
			const FVector Pa = At(Bones[I].A), Pb = At(Bones[I].B);
			if (!Valid(Pa) || !Valid(Pb)) { C->SetVisibility(false); continue; }
			C->SetVisibility(true);
			const FVector D = Pb - Pa;
			const float Len = D.Size();
			const float Dia = Bones[I].R * 2.f;                    // radius in metres; the basic cylinder is 1 m across, 1 m tall
			C->SetWorldLocationAndRotation((Pa + Pb) * 0.5f, FQuat::FindBetweenNormals(FVector::UpVector, Len > 0.01f ? D / Len : FVector::UpVector));
			C->SetWorldScale3D(FVector(Dia, Dia * 0.96f, FMath::Max(0.001f, Len / 100.f)));
		}
		if (HeadIdx != INDEX_NONE && HeadEndIdx != INDEX_NONE)
		{
			const FVector H = At(HeadIdx), He = At(HeadEndIdx);
			const FVector Hc = FMath::Lerp(H, He, 0.45f);
			FP.Value.Head->SetWorldLocation(Hc);
			FP.Value.Head->SetWorldScale3D(FVector(0.22f));
			if (HeadSideIdx != INDEX_NONE && Valid(At(HeadSideIdx)))
			{
				FVector Side = At(HeadSideIdx) - H;
				Side.Z = 0;
				const FVector Fwd = FVector::CrossProduct(FVector::UpVector, Side).GetSafeNormal();    // the desk's nose, mirrored with the axes
				FP.Value.Nose->SetVisibility(true);
				FP.Value.Nose->SetWorldLocationAndRotation(Hc + Fwd * 11.f, Fwd.Rotation());
				FP.Value.Nose->SetWorldScale3D(FVector(0.07f, 0.04f, 0.04f));
			}
			else
				FP.Value.Nose->SetVisibility(false);
		}
	}
}

void AStoryPreview::ApplyFrame(float Time)
{
	const FPvScene* S = Scenes.Find(SceneId);
	if (!S || S->Frames == 0) return;
	const float FF = FMath::Clamp(Time * S->Fps, 0.f, (float)(S->Frames - 1));
	const int32 F0 = FMath::FloorToInt(FF), F1 = FMath::Min(F0 + 1, S->Frames - 1);
	const float U = FF - F0;
	auto C = [&](int32 K) { return FMath::Lerp(S->Cam[F0 * 10 + K], S->Cam[F1 * 10 + K], U); };
	const FVector Pos(C(0), C(1), C(2)), Fwd(C(3), C(4), C(5)), Up(C(6), C(7), C(8));
	const FQuat Base = FRotationMatrix::MakeFromXZ(Fwd, Up).ToQuat();       // then the player's own look, as stage.apply turns it
	Camera->SetActorLocationAndRotation(Pos, Base * FRotator(UserLook.Y, UserLook.X, 0).Quaternion());
	Camera->GetCameraComponent()->SetFieldOfView(C(9));
	BlackAlpha = FMath::Max(BlackAlpha, FMath::Lerp(S->Black[F0], S->Black[F1], U));
	for (const auto& LP : S->Lights)
		if (const FLightRef* L = LightRefs.Find(LP.Key))
			if (L->Light.IsValid() && LP.Value.IsValidIndex(F0)) L->Light->SetIntensity(L->Base * LP.Value[F0]);
	SubEn = SubJa = SubWho = FText();
	for (const FPvSub& Sub : S->Subs)
		if (Time >= Sub.T0 && Time < Sub.T1)
		{
			SubEn = FText::FromString(Sub.En);
			SubJa = FText::FromString(Sub.Ja);
			SubWho = FText::FromString(Sub.Who.IsEmpty() ? S->Title : FString::Printf(TEXT("%s \u00B7 %s"), *S->Title, *Sub.Who));
		}
	ApplyFigures(Time);
	ApplyBodies(Time);
}

void AStoryPreview::UpdateLook(float Dt, const FPvScene& S)
{
	const float Sens = 0.25f, Rest = 1.5f, Back = 2.f;      // degrees a mouse count; idle secs before it eases back; ease rate
	float Dx = 0, Dy = 0;
	APlayerController* PC = GetWorld()->GetFirstPlayerController();
	if (PC && !bMouse) PC->GetInputMouseDelta(Dx, Dy);
	if (FMath::Abs(Dx) + FMath::Abs(Dy) > 0.01f) LookIdle = 0; else LookIdle += Dt;
	UserLook.X = FMath::Clamp(UserLook.X + Dx * Sens, -S.LookYaw, S.LookYaw);
	UserLook.Y = FMath::Clamp(UserLook.Y + Dy * Sens, -S.LookPitch, S.LookPitch);
	if (LookIdle > Rest) UserLook *= FMath::Exp(-Dt * Back);   // the spring back to the framing (GAMEPLAY_PLAN §1)
}

void AStoryPreview::Tick(float Dt)
{
	Super::Tick(Dt);
	if (Pending)
	{
		TFunction<void()> Fn = MoveTemp(Pending);
		Pending = nullptr;
		Fn();
	}
	if (TimerLeft >= 0)
	{
		TimerLeft -= Dt;
		TimerText = FText::FromString(FString::Printf(TEXT("%.1f"), FMath::Max(0.f, TimerLeft)));
		if (TimerLeft <= 0) { const FString Fail = TimerFail; TimerLeft = -1; Later([this, Fail]() { Go(Fail); }); }
	}
	const FPvScene* S = Scenes.Find(SceneId);
	if (S && (Mode == EMode::FadeIn || Mode == EMode::Scene || Mode == EMode::FadeOut)) UpdateLook(Dt, *S);
	if (!S && (Mode == EMode::FadeIn || Mode == EMode::Scene || Mode == EMode::FadeOut)) Mode = EMode::Idle;
	switch (Mode)
	{
	case EMode::FadeIn:
		PhaseT += Dt;
		BlackAlpha = 1.f - FMath::Clamp(PhaseT / FMath::Max(0.05f, S->EnterSecs), 0.f, 1.f);
		ApplyFrame(0);
		if (PhaseT >= S->EnterSecs) { Mode = EMode::Scene; BlackAlpha = 0; }
		break;
	case EMode::Scene:
	{
		if (S->Events.IsValidIndex(NextEvent) && T + Dt >= S->Events[NextEvent].T)
		{
			T = S->Events[NextEvent].T;
			BlackAlpha = 0;
			ApplyFrame(T);
			ShowEvent(S->Events[NextEvent++]);
			break;
		}
		T += Dt;
		BlackAlpha = 0;
		ApplyFrame(FMath::Min(T, S->Total));
		if (T >= S->Total) { Mode = S->bExitCut ? EMode::Idle : EMode::FadeOut; PhaseT = 0; if (S->bExitCut) Later([this]() { EndScene(); }); }
		break;
	}
	case EMode::FadeOut:
		PhaseT += Dt;
		BlackAlpha = FMath::Clamp(PhaseT / FMath::Max(0.05f, S->ExitSecs), 0.f, 1.f);
		if (PhaseT >= S->ExitSecs) { Mode = EMode::Idle; Later([this]() { EndScene(); }); }
		break;
	default:
		break;
	}
}
