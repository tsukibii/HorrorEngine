#pragma once

#include "CoreMinimal.h"
#include "UltraVHSSettings.generated.h"

/** Starting points. Camcorder is measured from the reference video (README.md "The reference"). */
UENUM(BlueprintType)
enum class EUltraVHSPreset : uint8
{
	/** A clean home camcorder: soft, haloed edges, bled colour, lifted blacks, barrel lens. No tape damage. */
	Camcorder,
	/** The same tape played back a few years later: noise, chroma smear, jitter, the head-switching tear. */
	WornTape,
	/** A tape that shouldn't have survived: rolling tracking errors, dropouts, colour falling apart. */
	Nightmare,
	/** Whatever the settings say (any edit to them in the editor switches to this). */
	Custom,
};

/**
 * The post-process's knobs. Distances on the tape are in 480-line pixels, so they mean the same at any TapeLines.
 * Defaults are the Camcorder preset.
 */
USTRUCT(BlueprintType)
struct ULTRAVHS_API FUltraVHSSettings
{
	GENERATED_BODY()

	/** Record a 4:3 frame and pillarbox it on a wider screen (the reference does). Off: the tape takes the screen's shape. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Frame")
	bool bCrop4x3 = true;

	/** The tape's lines (its height in pixels). 480 is NTSC; 240 is one field, softer still. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Frame", meta = (ClampMin = "120", ClampMax = "1080"))
	int32 TapeLines = 480;

	/** Barrel distortion k in r' = r (1 + k r^2), r in half-heights; the frame is zoomed so the corners stay filled. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Lens", meta = (ClampMin = "-0.3", ClampMax = "0.5"))
	float Distortion = 0.085f;

	/** Red/blue fringe at the corners, in tape pixels. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Lens", meta = (ClampMin = "0", ClampMax = "8"))
	float ChromaticAberration = 0.f;

	/** Darkening toward the corners: 1 / (1 + v r^2)^2. 0.08 leaves the corners at about 75% of the centre. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Lens", meta = (ClampMin = "0", ClampMax = "1"))
	float Vignette = 0.08f;

	/** What black records as (camcorders lift and warm it). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	FLinearColor BlackLevel = FLinearColor(0.035f, 0.027f, 0.022f, 1.f);

	/** What full white records as (the reference's whites stop near 0.78, before the vignette). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	FLinearColor WhiteLevel = FLinearColor(0.82f, 0.81f, 0.78f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera", meta = (ClampMin = "0", ClampMax = "2"))
	float Saturation = 0.8f;

	/** Luma softness across the line (Gaussian sigma, tape pixels). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "0.35", ClampMax = "6"))
	float LumaBlur = 1.4f;

	/** The deck's edge enhancement: the bright halo beside edges. 1.0 overshoots about 12%, like the reference. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "0", ClampMax = "3"))
	float Sharpen = 1.f;

	/** How wide the halo is (tape pixels). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "1", ClampMax = "8"))
	float SharpenRadius = 3.f;

	/** Colour bleed across the line (Gaussian sigma, tape pixels). 2 makes colour edges about 2.5 times as wide as luma's. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "0.5", ClampMax = "16"))
	float ChromaBlur = 2.f;

	/** Colour arriving late, to the right (tape pixels). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "-8", ClampMax = "8"))
	float ChromaShift = 0.f;

	/** How much each line's colour is shared with the line above (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "0", ClampMax = "1"))
	float ChromaVerticalBlend = 0.5f;

	/** How much of the last frame stays (a soft trail in motion). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Tape", meta = (ClampMin = "0", ClampMax = "0.9"))
	float Ghosting = 0.15f;

	/** Luma snow (fine horizontal streaks). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wear", meta = (ClampMin = "0", ClampMax = "2"))
	float LumaNoise = 0.f;

	/** Colour noise (long smears along the line). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wear", meta = (ClampMin = "0", ClampMax = "2"))
	float ChromaNoise = 0.f;

	/** Lines slipping sideways, and a slow wobble of the frame (tape pixels). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wear", meta = (ClampMin = "0", ClampMax = "8"))
	float TrackingJitter = 0.f;

	/** A band of torn, noisy lines rolling down the frame (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wear", meta = (ClampMin = "0", ClampMax = "1"))
	float TrackingError = 0.f;

	/** The head-switching tear along the bottom few lines (0..1). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wear", meta = (ClampMin = "0", ClampMax = "1"))
	float HeadSwitch = 0.f;

	/** Short white streaks where the oxide is gone. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Wear", meta = (ClampMin = "0", ClampMax = "4"))
	float Dropouts = 0.f;

	/** Dark gaps between the tape's lines on the screen (0..1; the reference has none). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Screen", meta = (ClampMin = "0", ClampMax = "1"))
	float Scanlines = 0.f;

	static FUltraVHSSettings FromPreset(EUltraVHSPreset Preset);
};

/**
 * The handheld camera: how a person holds a camcorder. Angles in degrees, distances in cm. Measured from the
 * reference: a slow wander at 0.3 to 0.5 Hz and a sideways sway at 1 Hz (every other step) while walking.
 */
USTRUCT(BlueprintType)
struct ULTRAVHS_API FUltraVHSHandheldSettings
{
	GENERATED_BODY()

	/** Everything below, scaled. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld", meta = (ClampMin = "0", ClampMax = "3"))
	float Intensity = 1.f;

	/** The hands' slow wander, standing still. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Drift")
	float DriftPitch = 0.45f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Drift")
	float DriftYaw = 0.6f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Drift")
	float DriftRoll = 0.35f;

	/** How fast the wander moves (Hz). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Drift", meta = (ClampMin = "0.05", ClampMax = "3"))
	float DriftSpeed = 0.35f;

	/** The wander while walking, as a multiple of standing still. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Drift", meta = (ClampMin = "0", ClampMax = "5"))
	float WalkingDrift = 1.6f;

	/** Breathing: a slow nod (about 15 breaths a minute). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Drift")
	float BreathPitch = 0.12f;

	/** The speed (cm/s) that counts as a full walk; faster bobs a bit more, up to 1.25 times. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk", meta = (ClampMin = "10"))
	float WalkSpeed = 300.f;

	/** Steps per second at WalkSpeed (it grows with the square root of the speed). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk", meta = (ClampMin = "0.5", ClampMax = "4"))
	float StepsPerSecond = 2.f;

	/** Up and down, once per step (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk")
	float BobHeight = 1.2f;

	/** Side to side, once per two steps (cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk")
	float BobSway = 0.8f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk")
	float BobPitch = 0.35f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk")
	float BobYaw = 0.25f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Walk")
	float BobRoll = 0.45f;

	/** Banking into a turn: degrees of roll per degree a second of turning. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Turn")
	float TurnRoll = 0.012f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Turn")
	float MaxTurnRoll = 2.5f;

	/** The camera's weight: how far behind the look it trails (seconds; 0 is none). The aim is unchanged. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Handheld|Turn", meta = (ClampMin = "0", ClampMax = "0.5"))
	float RotationLag = 0.04f;
};
