#pragma once

#include "CoreMinimal.h"
#include "LightKitTypes.generated.h"

/** The times of day the sky knows. Custom is whatever the settings say (any edit to them switches to it). */
UENUM(BlueprintType)
enum class ELightKitTime : uint8
{
	Day,
	Dusk,
	Night,
	Custom,
};

UENUM(BlueprintType)
enum class ELightKitLighting : uint8
{
	/** Movable sun and sky, the sky captured live: for Lumen or no GI. The time can change while playing. */
	Dynamic,
	/** Stationary sun and sky for a Lightmass bake: soft baked bounce, dynamic shadows. One bake per time of day
	 * (a Lighting Scenario level each); the time is fixed while playing. */
	Baked,
};

UENUM(BlueprintType)
enum class ELightKitAuto : uint8
{
	/** On when it helps: the fake bounce is on without Lumen and without a bake. */
	Auto,
	On,
	Off,
};

/** The moving patterns the kit's light-function materials draw (lightkit_materials.build() makes them). */
UENUM(BlueprintType)
enum class ELightKitPattern : uint8
{
	None,
	/** Light off water: a moving net of bright lines (a bath, a pool, a fish tank, a wet floor under a lamp). */
	Caustics,
	/** Sun through trees: soft dapples that sway. */
	Leaves,
	/** Venetian blinds: stripes. */
	Blinds,
	/** Cloud shadows drifting over the ground (for the sky's sun). */
	Clouds,
};

/**
 * One time of day: the sun (or moon), the sky, the windows' fill, the fog and the camera. Physical units: lux for the
 * sun, cd/m² for what a window shows, EV100 for exposure. Defaults are Day.
 */
USTRUCT(BlueprintType)
struct LIGHTKIT_API FLightKitTimeSettings
{
	GENERATED_BODY()

	/** Degrees above the horizon. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sun", meta = (ClampMin = "-10", ClampMax = "90"))
	float SunElevation = 50.f;

	/** Degrees round from +X (the compass the sun comes from). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sun")
	float SunAzimuth = 135.f;

	/** Lux. A clear midday is about 100000, the full moon 0.25 (the night here is a brighter, film moon). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sun", meta = (ClampMin = "0"))
	float SunIntensity = 80000.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sun")
	FLinearColor SunColor = FLinearColor(1.f, 0.95f, 0.88f, 1.f);

	/** The sun's size in degrees: the penumbra. The real sun is 0.53; larger is softer, smoother shadows. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sun", meta = (ClampMin = "0", ClampMax = "10"))
	float SunSourceAngle = 1.f;

	/** The sky light's intensity (it captures the sky, so it follows the sun on its own). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sky", meta = (ClampMin = "0"))
	float SkyIntensity = 1.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sky")
	FLinearColor SkyColor = FLinearColor(1.f, 1.f, 1.f, 1.f);

	/** Scales the sky's own brightness (the atmosphere's luminance factor): the night's deep blue lives here. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Sky")
	FLinearColor SkyGlow = FLinearColor(1.f, 1.f, 1.f, 1.f);

	/** What a window shows from inside, cd/m²: the sky's light coming in (Light Kit Window's fill). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Windows", meta = (ClampMin = "0"))
	float WindowLuminance = 2500.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Windows")
	FLinearColor WindowColor = FLinearColor(0.8f, 0.88f, 1.f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fog", meta = (ClampMin = "0"))
	float FogDensity = 0.005f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fog", meta = (ClampMin = "0.001"))
	float FogHeightFalloff = 0.2f;

	/** The fog's own colour (the sky adds to it). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fog")
	FLinearColor FogColor = FLinearColor(0.447f, 0.638f, 1.f, 1.f);

	/** Auto exposure's range, EV100 (the camcorder's iris). Indoors by day is about 8, a sunny street 14. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	float ExposureMin = 6.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	float ExposureMax = 14.f;

	/** Exposure compensation in stops. Night is under: auto exposure alone would turn night into grey day. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	float ExposureBias = 0.f;

	/** White balance, K. Lower is bluer. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera", meta = (ClampMin = "1500", ClampMax = "15000"))
	float WhiteTemp = 6500.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera", meta = (ClampMin = "0", ClampMax = "2"))
	float Saturation = 1.f;

	/** Added to the shadows: the colour darkness settles to instead of black. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera")
	FLinearColor ShadowLift = FLinearColor(0.f, 0.f, 0.f, 0.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Camera", meta = (ClampMin = "0"))
	float Bloom = 0.3f;

	/** How bright windows' light shafts are (screen-relative: 0.1 adds a tenth of white). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Windows", meta = (ClampMin = "0"))
	float ShaftIntensity = 0.12f;

	static FLightKitTimeSettings FromPreset(ELightKitTime Time);
	static FLightKitTimeSettings Lerp(const FLightKitTimeSettings& A, const FLightKitTimeSettings& B, float T);
};

namespace LightKit
{
	/** The Day preset's sun, the yardstick patterns and sweeps scale by. */
	constexpr float DaySunLux = 80000.f;

	/** The materials lightkit_materials.build() makes, in the plugin's content. */
	LIGHTKIT_API const TCHAR* PatternMaterialPath(ELightKitPattern Pattern);
	constexpr const TCHAR* ShaftMaterialPath = TEXT("/LightKit/Materials/M_LightKit_Shaft.M_LightKit_Shaft");
	constexpr const TCHAR* WetMaterialPath = TEXT("/LightKit/Materials/M_LightKit_Wet.M_LightKit_Wet");

	/** Lumen is the project's (or the current) global illumination. */
	LIGHTKIT_API bool IsLumenOn();
}
