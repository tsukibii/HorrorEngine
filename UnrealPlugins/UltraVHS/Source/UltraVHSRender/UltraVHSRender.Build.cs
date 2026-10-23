using UnrealBuildTool;

// The render half: the shaders and the scene view extension. Loads at PostConfigInit so its global shaders are
// known before the engine compiles the global shader map. No UObjects here (they live in the UltraVHS module).
public class UltraVHSRender : ModuleRules
{
	public UltraVHSRender(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] { "Core", "Engine", "RenderCore", "Renderer", "RHI" });
		PrivateDependencyModuleNames.AddRange(new string[] { "CoreUObject", "Projects" });
	}
}
