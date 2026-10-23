using UnrealBuildTool;

// The game half: the settings, the component you add to a player, the world subsystem that feeds the post-process,
// and the handheld camera modifier.
public class UltraVHS : ModuleRules
{
	public UltraVHS(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		PrivateDependencyModuleNames.AddRange(new string[] { "UltraVHSRender", "RenderCore", "Renderer", "RHI" });
	}
}
