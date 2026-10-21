// The studio's own module (docs/STUDIO.md): the StoryRunner (docs/RUNNER_SPEC.md) and, first, the StoryPreview that
// plays the desk's baked Watch (docs/UNREAL_FLOW.md §1b). Epic's template module stays as it was.

using UnrealBuildTool;

public class StoryRunner : ModuleRules
{
	public StoryRunner(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine", "InputCore" });
		PrivateDependencyModuleNames.AddRange(new string[] { "Slate", "SlateCore", "Json" });
	}
}
