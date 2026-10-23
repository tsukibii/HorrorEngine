#include "Modules/ModuleManager.h"
#include "Interfaces/IPluginManager.h"
#include "Misc/Paths.h"
#include "ShaderCore.h"

class FUltraVHSRenderModule : public IModuleInterface
{
public:
	virtual void StartupModule() override
	{
		// the plugin's folder name must stay "UltraVHS" (the .uplugin's name)
		const TSharedPtr<IPlugin> Plugin = IPluginManager::Get().FindPlugin(TEXT("UltraVHS"));
		check(Plugin.IsValid());
		AddShaderSourceDirectoryMapping(TEXT("/Plugin/UltraVHS"), FPaths::Combine(Plugin->GetBaseDir(), TEXT("Shaders")));
	}
};

IMPLEMENT_MODULE(FUltraVHSRenderModule, UltraVHSRender)
