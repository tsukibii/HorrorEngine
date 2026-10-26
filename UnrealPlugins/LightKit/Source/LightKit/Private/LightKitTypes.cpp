#include "LightKitTypes.h"

#include "HAL/IConsoleManager.h"

FLightKitTimeSettings FLightKitTimeSettings::FromPreset(ELightKitTime Time)
{
	FLightKitTimeSettings S; // Day

	switch (Time)
	{
	case ELightKitTime::Dusk:
		S.SunElevation = 6.f;
		S.SunIntensity = 4000.f;
		S.SunColor = FLinearColor(1.f, 0.6f, 0.34f, 1.f);
		S.SunSourceAngle = 1.5f;
		S.SkyIntensity = 1.f;
		S.SkyColor = FLinearColor(1.f, 0.92f, 0.9f, 1.f);
		S.WindowLuminance = 250.f;
		S.WindowColor = FLinearColor(1.f, 0.72f, 0.58f, 1.f);
		S.FogDensity = 0.015f;
		S.FogColor = FLinearColor(0.9f, 0.55f, 0.42f, 1.f);
		S.ExposureMin = 3.f;
		S.ExposureMax = 10.f;
		S.WhiteTemp = 6200.f;
		S.Saturation = 1.05f;
		S.ShadowLift = FLinearColor(0.f, 0.f, 0.003f, 0.f);
		S.Bloom = 0.5f;
		S.ShaftIntensity = 0.25f;
		break;

	case ELightKitTime::Night:
		// a film moon: cool, soft, bright enough to see by; the sky and the shadows settle to a deep blue
		S.SunElevation = 35.f;
		S.SunIntensity = 1.5f;
		S.SunColor = FLinearColor(0.55f, 0.7f, 1.f, 1.f);
		S.SunSourceAngle = 1.f;
		S.SkyIntensity = 2.5f;
		S.SkyColor = FLinearColor(0.45f, 0.6f, 1.f, 1.f);
		S.SkyGlow = FLinearColor(2.f, 2.5f, 4.f, 1.f);
		S.WindowLuminance = 0.4f;
		S.WindowColor = FLinearColor(0.35f, 0.5f, 1.f, 1.f);
		S.FogDensity = 0.015f;
		S.FogColor = FLinearColor(0.01f, 0.02f, 0.05f, 1.f);
		S.ExposureMin = -2.f;
		S.ExposureMax = 1.f;
		S.ExposureBias = -1.f;
		S.WhiteTemp = 6500.f;
		S.Saturation = 0.8f;
		S.ShadowLift = FLinearColor(0.f, 0.004f, 0.012f, 0.f);
		S.Bloom = 0.6f;
		S.ShaftIntensity = 0.04f;
		break;

	default:
		break;
	}
	return S;
}

FLightKitTimeSettings FLightKitTimeSettings::Lerp(const FLightKitTimeSettings& A, const FLightKitTimeSettings& B, float T)
{
	auto L = [T](float X, float Y) { return FMath::Lerp(X, Y, T); };
	auto C = [T](const FLinearColor& X, const FLinearColor& Y) { return FMath::Lerp(X, Y, T); };

	FLightKitTimeSettings S;
	S.SunElevation = L(A.SunElevation, B.SunElevation);
	S.SunAzimuth = A.SunAzimuth + FMath::FindDeltaAngleDegrees(A.SunAzimuth, B.SunAzimuth) * T;
	// light levels span orders of magnitude: blend them in stops, so dusk doesn't flash
	auto LogL = [T](float X, float Y) { return FMath::Exp(FMath::Lerp(FMath::Loge(FMath::Max(X, 1e-4f)), FMath::Loge(FMath::Max(Y, 1e-4f)), T)); };
	S.SunIntensity = LogL(A.SunIntensity, B.SunIntensity);
	S.SunColor = C(A.SunColor, B.SunColor);
	S.SunSourceAngle = L(A.SunSourceAngle, B.SunSourceAngle);
	S.SkyIntensity = L(A.SkyIntensity, B.SkyIntensity);
	S.SkyColor = C(A.SkyColor, B.SkyColor);
	S.SkyGlow = C(A.SkyGlow, B.SkyGlow);
	S.WindowLuminance = LogL(A.WindowLuminance, B.WindowLuminance);
	S.WindowColor = C(A.WindowColor, B.WindowColor);
	S.FogDensity = L(A.FogDensity, B.FogDensity);
	S.FogHeightFalloff = L(A.FogHeightFalloff, B.FogHeightFalloff);
	S.FogColor = C(A.FogColor, B.FogColor);
	S.ExposureMin = L(A.ExposureMin, B.ExposureMin);
	S.ExposureMax = L(A.ExposureMax, B.ExposureMax);
	S.ExposureBias = L(A.ExposureBias, B.ExposureBias);
	S.WhiteTemp = L(A.WhiteTemp, B.WhiteTemp);
	S.Saturation = L(A.Saturation, B.Saturation);
	S.ShadowLift = C(A.ShadowLift, B.ShadowLift);
	S.Bloom = L(A.Bloom, B.Bloom);
	S.ShaftIntensity = L(A.ShaftIntensity, B.ShaftIntensity);
	return S;
}

namespace LightKit
{
	const TCHAR* PatternMaterialPath(ELightKitPattern Pattern)
	{
		switch (Pattern)
		{
		case ELightKitPattern::Caustics: return TEXT("/LightKit/Materials/LF_LightKit_Caustics.LF_LightKit_Caustics");
		case ELightKitPattern::Leaves: return TEXT("/LightKit/Materials/LF_LightKit_Leaves.LF_LightKit_Leaves");
		case ELightKitPattern::Blinds: return TEXT("/LightKit/Materials/LF_LightKit_Blinds.LF_LightKit_Blinds");
		case ELightKitPattern::Clouds: return TEXT("/LightKit/Materials/LF_LightKit_Clouds.LF_LightKit_Clouds");
		default: return nullptr;
		}
	}

	bool IsLumenOn()
	{
		static const IConsoleVariable* GI = IConsoleManager::Get().FindConsoleVariable(TEXT("r.DynamicGlobalIlluminationMethod"));
		return GI && GI->GetInt() == 1;
	}
}
