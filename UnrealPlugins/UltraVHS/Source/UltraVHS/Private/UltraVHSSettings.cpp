#include "UltraVHSSettings.h"

FUltraVHSSettings FUltraVHSSettings::FromPreset(EUltraVHSPreset Preset)
{
	FUltraVHSSettings S; // Camcorder

	switch (Preset)
	{
	case EUltraVHSPreset::WornTape:
		S.Saturation = 0.7f;
		S.LumaBlur = 1.6f;
		S.ChromaBlur = 3.f;
		S.ChromaShift = 1.5f;
		S.Ghosting = 0.2f;
		S.LumaNoise = 0.25f;
		S.ChromaNoise = 0.35f;
		S.TrackingJitter = 0.4f;
		S.HeadSwitch = 0.6f;
		S.Dropouts = 0.3f;
		break;

	case EUltraVHSPreset::Nightmare:
		S.TapeLines = 360;
		S.Saturation = 0.55f;
		S.BlackLevel = FLinearColor(0.06f, 0.045f, 0.045f, 1.f);
		S.WhiteLevel = FLinearColor(0.74f, 0.72f, 0.70f, 1.f);
		S.LumaBlur = 1.8f;
		S.ChromaBlur = 4.5f;
		S.ChromaShift = 3.f;
		S.Ghosting = 0.3f;
		S.LumaNoise = 0.5f;
		S.ChromaNoise = 0.7f;
		S.TrackingJitter = 1.f;
		S.TrackingError = 0.5f;
		S.HeadSwitch = 1.f;
		S.Dropouts = 1.f;
		S.Scanlines = 0.15f;
		break;

	default:
		break;
	}
	return S;
}
