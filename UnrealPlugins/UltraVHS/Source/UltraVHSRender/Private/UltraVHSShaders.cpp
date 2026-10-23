#include "UltraVHSShaders.h"

// "/Plugin/UltraVHS" is mapped to the plugin's Shaders folder in FUltraVHSRenderModule::StartupModule.
IMPLEMENT_GLOBAL_SHADER(FUltraVHSCapturePS, "/Plugin/UltraVHS/Private/UltraVHS.usf", "CapturePS", SF_Pixel);
IMPLEMENT_GLOBAL_SHADER(FUltraVHSTapePS, "/Plugin/UltraVHS/Private/UltraVHS.usf", "TapePS", SF_Pixel);
IMPLEMENT_GLOBAL_SHADER(FUltraVHSDisplayPS, "/Plugin/UltraVHS/Private/UltraVHS.usf", "DisplayPS", SF_Pixel);
