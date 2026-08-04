#!/usr/bin/env python3
"""Generate LitterLog.xcodeproj/project.pbxproj with app, widget, and test targets."""

from __future__ import annotations

import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "LitterLog.xcodeproj" / "project.pbxproj"


def uid(name: str) -> str:
    return hashlib.md5(name.encode("utf-8")).hexdigest()[:24].upper()


SHARED_SWIFT = [
    "LitterLogShared/Models/BathroomEvent.swift",
    "LitterLogShared/Models/BathroomEventType.swift",
    "LitterLogShared/Models/EventSource.swift",
    "LitterLogShared/Models/AppSettings.swift",
    "LitterLogShared/Models/TodaySummary.swift",
    "LitterLogShared/Persistence/EventStorePayload.swift",
    "LitterLogShared/Persistence/SharedEventStore.swift",
    "LitterLogShared/Persistence/SharedStoreError.swift",
    "LitterLogShared/Export/CSVExporter.swift",
    "LitterLogShared/Intents/LogBathroomEventIntent.swift",
    "LitterLogShared/Utilities/AppGroupConfiguration.swift",
    "LitterLogShared/Utilities/DateGrouping.swift",
    "LitterLogShared/Utilities/LitterLogPalette.swift",
    "LitterLogShared/Utilities/SafetyNoticePolicy.swift",
    "LitterLogShared/Utilities/SampleData.swift",
]

APP_SWIFT = [
    "LitterLog/LitterLogApp.swift",
    "LitterLog/Features/Home/AppModel.swift",
    "LitterLog/Features/Home/HomeView.swift",
    "LitterLog/Features/History/HistoryView.swift",
    "LitterLog/Features/History/EventEditorView.swift",
    "LitterLog/Features/Settings/SettingsView.swift",
    "LitterLog/SharedUI/LogEventButton.swift",
    "LitterLog/SharedUI/RecentEventRow.swift",
    "LitterLog/SharedUI/SafetyNoticeView.swift",
    "LitterLog/Export/ExportSheetView.swift",
]

WIDGET_SWIFT = [
    "LitterLogWidget/LitterLogWidgetBundle.swift",
    "LitterLogWidget/LitterLogWidget.swift",
]

TEST_SWIFT = [
    "LitterLogTests/SharedEventStoreTests.swift",
    "LitterLogTests/TodaySummaryTests.swift",
    "LitterLogTests/CSVExporterTests.swift",
    "LitterLogTests/SafetyNoticePolicyTests.swift",
    "LitterLogTests/DateGroupingTests.swift",
]


def main() -> None:
    objects: dict[str, str] = {}
    file_refs: dict[str, str] = {}

    def add_object(key: str, body: str) -> str:
        oid = uid(key)
        objects[oid] = body
        return oid

    # File references — use path relative to project for reliability
    for path in SHARED_SWIFT + APP_SWIFT + WIDGET_SWIFT + TEST_SWIFT:
        name = Path(path).name
        ref = add_object(
            f"fileref:{path}",
            f"\t\t{{oid}} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {path}; sourceTree = \"<group>\"; }};\n".replace(
                "{oid}", uid(f"fileref:{path}")
            ),
        )
        # fix: add_object already used uid; rewrite properly
        file_refs[path] = ref

    # Rewrite file refs cleanly
    objects.clear()
    file_refs.clear()

    def file_ref(path: str, file_type: str = "sourcecode.swift") -> str:
        name = Path(path).name
        oid = uid(f"fileref:{path}")
        # For groups that set path to parent, children should use just the filename.
        # We'll use project-relative paths on every file ref and a flat Root group to avoid path bugs.
        objects[oid] = (
            f"\t\t{oid} /* {name} */ = {{isa = PBXFileReference; lastKnownFileType = {file_type}; "
            f"name = {name}; path = {path}; sourceTree = \"<group>\"; }};\n"
        )
        file_refs[path] = oid
        return oid

    for path in SHARED_SWIFT + APP_SWIFT + WIDGET_SWIFT + TEST_SWIFT:
        file_ref(path)

    app_assets = file_ref("LitterLog/Assets.xcassets", "folder.assetcatalog")
    widget_assets = file_ref("LitterLogWidget/Assets.xcassets", "folder.assetcatalog")
    app_entitlements = file_ref("LitterLog/LitterLog.entitlements", "text.plist.entitlements")
    widget_entitlements = file_ref("LitterLogWidget/LitterLogWidget.entitlements", "text.plist.entitlements")
    app_info = file_ref("LitterLog/Info.plist", "text.plist.xml")
    widget_info = file_ref("LitterLogWidget/Info.plist", "text.plist.xml")
    privacy_info = file_ref("LitterLog/PrivacyInfo.xcprivacy", "text.xml")

    app_product = uid("fileref:LitterLog.app")
    objects[app_product] = (
        f'\t\t{app_product} /* LitterLog.app */ = {{isa = PBXFileReference; explicitFileType = wrapper.application; '
        f'includeInIndex = 0; path = LitterLog.app; sourceTree = BUILT_PRODUCTS_DIR; }};\n'
    )
    widget_product = uid("fileref:LitterLogWidget.appex")
    objects[widget_product] = (
        f'\t\t{widget_product} /* LitterLogWidget.appex */ = {{isa = PBXFileReference; explicitFileType = "wrapper.app-extension"; '
        f'includeInIndex = 0; path = LitterLogWidget.appex; sourceTree = BUILT_PRODUCTS_DIR; }};\n'
    )
    tests_product = uid("fileref:LitterLogTests.xctest")
    objects[tests_product] = (
        f'\t\t{tests_product} /* LitterLogTests.xctest */ = {{isa = PBXFileReference; explicitFileType = wrapper.cfbundle; '
        f'includeInIndex = 0; path = LitterLogTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; }};\n'
    )

    build_files: dict[str, str] = {}

    def build_file(key: str, file_ref_id: str, name: str, settings: str | None = None) -> str:
        oid = uid(f"buildfile:{key}")
        settings_block = f" settings = {{{settings}}};" if settings else ""
        objects[oid] = (
            f"\t\t{oid} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_ref_id} /* {name} */;{settings_block} }};\n"
        )
        # Fix comment for resources/embed later by overwriting when needed
        build_files[key] = oid
        return oid

    app_source_builds = []
    widget_source_builds = []
    test_source_builds = []

    for path in SHARED_SWIFT + APP_SWIFT:
        name = Path(path).name
        bid = uid(f"buildfile-app:{path}")
        objects[bid] = f"\t\t{bid} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[path]} /* {name} */; }};\n"
        app_source_builds.append(bid)

    for path in SHARED_SWIFT + WIDGET_SWIFT:
        name = Path(path).name
        bid = uid(f"buildfile-widget:{path}")
        objects[bid] = f"\t\t{bid} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[path]} /* {name} */; }};\n"
        widget_source_builds.append(bid)

    for path in TEST_SWIFT:
        name = Path(path).name
        bid = uid(f"buildfile-test:{path}")
        objects[bid] = f"\t\t{bid} /* {name} in Sources */ = {{isa = PBXBuildFile; fileRef = {file_refs[path]} /* {name} */; }};\n"
        test_source_builds.append(bid)

    app_assets_build = uid("buildfile-app:Assets")
    objects[app_assets_build] = (
        f"\t\t{app_assets_build} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {app_assets} /* Assets.xcassets */; }};\n"
    )
    privacy_build = uid("buildfile-app:PrivacyInfo")
    objects[privacy_build] = (
        f"\t\t{privacy_build} /* PrivacyInfo.xcprivacy in Resources */ = {{isa = PBXBuildFile; fileRef = {privacy_info} /* PrivacyInfo.xcprivacy */; }};\n"
    )
    widget_assets_build = uid("buildfile-widget:Assets")
    objects[widget_assets_build] = (
        f"\t\t{widget_assets_build} /* Assets.xcassets in Resources */ = {{isa = PBXBuildFile; fileRef = {widget_assets} /* Assets.xcassets */; }};\n"
    )
    embed_widget_build = uid("buildfile:embed-widget")
    objects[embed_widget_build] = (
        f"\t\t{embed_widget_build} /* LitterLogWidget.appex in Embed Foundation Extensions */ = "
        f"{{isa = PBXBuildFile; fileRef = {widget_product} /* LitterLogWidget.appex */; "
        f"settings = {{ATTRIBUTES = (RemoveHeadersOnCopy, ); }}; }};\n"
    )

    def group(key: str, name: str, children: list[str], path: str | None = None) -> str:
        oid = uid(f"group:{key}")
        child_lines = "".join(f"\t\t\t\t{cid},\n" for cid in children)
        path_line = f"\t\t\tpath = {path};\n" if path else ""
        objects[oid] = (
            f"\t\t{oid} /* {name} */ = {{\n"
            f"\t\t\tisa = PBXGroup;\n"
            f"\t\t\tchildren = (\n"
            f"{child_lines}"
            f"\t\t\t);\n"
            f"{path_line}"
            f'\t\t\tsourceTree = "<group>";\n'
            f"\t\t}};\n"
        )
        return oid

    # Flat groups with project-relative file paths — simplest reliable structure
    app_group = group(
        "LitterLog",
        "LitterLog",
        [file_refs[p] for p in APP_SWIFT] + [app_assets, app_entitlements, app_info, privacy_info],
    )
    shared_group = group(
        "LitterLogShared",
        "LitterLogShared",
        [file_refs[p] for p in SHARED_SWIFT],
    )
    widget_group = group(
        "LitterLogWidget",
        "LitterLogWidget",
        [file_refs[p] for p in WIDGET_SWIFT] + [widget_assets, widget_entitlements, widget_info],
    )
    tests_group = group(
        "LitterLogTests",
        "LitterLogTests",
        [file_refs[p] for p in TEST_SWIFT],
    )
    products_group = group(
        "Products",
        "Products",
        [app_product, widget_product, tests_product],
    )
    root_group = group(
        "Root",
        "LitterLog",
        [app_group, shared_group, widget_group, tests_group, products_group],
    )

    # Phases / targets
    app_sources_phase = uid("phase:app-sources")
    app_resources_phase = uid("phase:app-resources")
    app_frameworks_phase = uid("phase:app-frameworks")
    app_embed_phase = uid("phase:app-embed")
    widget_sources_phase = uid("phase:widget-sources")
    widget_resources_phase = uid("phase:widget-resources")
    widget_frameworks_phase = uid("phase:widget-frameworks")
    tests_sources_phase = uid("phase:tests-sources")
    tests_frameworks_phase = uid("phase:tests-frameworks")

    objects[app_sources_phase] = (
        f"\t\t{app_sources_phase} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n"
        + "".join(f"\t\t\t\t{bid} /* in Sources */,\n" for bid in app_source_builds)
        + "\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
    )
    objects[widget_sources_phase] = (
        f"\t\t{widget_sources_phase} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n"
        + "".join(f"\t\t\t\t{bid} /* in Sources */,\n" for bid in widget_source_builds)
        + "\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
    )
    objects[tests_sources_phase] = (
        f"\t\t{tests_sources_phase} /* Sources */ = {{\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n"
        + "".join(f"\t\t\t\t{bid} /* in Sources */,\n" for bid in test_source_builds)
        + "\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
    )
    objects[app_resources_phase] = (
        f"\t\t{app_resources_phase} /* Resources */ = {{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n"
        f"\t\t\t\t{app_assets_build} /* Assets.xcassets in Resources */,\n"
        f"\t\t\t\t{privacy_build} /* PrivacyInfo.xcprivacy in Resources */,\n"
        f"\t\t\t);\n"
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
    )
    objects[widget_resources_phase] = (
        f"\t\t{widget_resources_phase} /* Resources */ = {{\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n"
        f"\t\t\tfiles = (\n\t\t\t\t{widget_assets_build} /* Assets.xcassets in Resources */,\n\t\t\t);\n"
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
    )
    for phase_id, name in [
        (app_frameworks_phase, "app"),
        (widget_frameworks_phase, "widget"),
        (tests_frameworks_phase, "tests"),
    ]:
        objects[phase_id] = (
            f"\t\t{phase_id} /* Frameworks */ = {{\n\t\t\tisa = PBXFrameworksBuildPhase;\n"
            f"\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n"
            f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
        )
    objects[app_embed_phase] = (
        f"\t\t{app_embed_phase} /* Embed Foundation Extensions */ = {{\n"
        f"\t\t\tisa = PBXCopyFilesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n"
        f'\t\t\tdstPath = "";\n\t\t\tdstSubfolderSpec = 13;\n\t\t\tfiles = (\n'
        f"\t\t\t\t{embed_widget_build} /* LitterLogWidget.appex in Embed Foundation Extensions */,\n"
        f'\t\t\t);\n\t\t\tname = "Embed Foundation Extensions";\n'
        f"\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t}};\n"
    )

    app_target = uid("target:LitterLog")
    widget_target = uid("target:LitterLogWidget")
    tests_target = uid("target:LitterLogTests")
    project_id = uid("project:LitterLog")
    container_proxy = uid("proxy:widget")
    target_dependency = uid("dependency:widget")

    objects[container_proxy] = (
        f"\t\t{container_proxy} /* PBXContainerItemProxy */ = {{\n"
        f"\t\t\tisa = PBXContainerItemProxy;\n"
        f"\t\t\tcontainerPortal = {project_id} /* Project object */;\n"
        f"\t\t\tproxyType = 1;\n"
        f"\t\t\tremoteGlobalIDString = {widget_target};\n"
        f"\t\t\tremoteInfo = LitterLogWidget;\n"
        f"\t\t}};\n"
    )
    objects[target_dependency] = (
        f"\t\t{target_dependency} /* PBXTargetDependency */ = {{\n"
        f"\t\t\tisa = PBXTargetDependency;\n"
        f"\t\t\ttarget = {widget_target} /* LitterLogWidget */;\n"
        f"\t\t\ttargetProxy = {container_proxy} /* PBXContainerItemProxy */;\n"
        f"\t\t}};\n"
    )

    app_config_list = uid("configlist:app")
    widget_config_list = uid("configlist:widget")
    tests_config_list = uid("configlist:tests")
    project_config_list = uid("configlist:project")
    app_debug, app_release = uid("config:app-debug"), uid("config:app-release")
    widget_debug, widget_release = uid("config:widget-debug"), uid("config:widget-release")
    tests_debug, tests_release = uid("config:tests-debug"), uid("config:tests-release")
    project_debug, project_release = uid("config:project-debug"), uid("config:project-release")

    objects[app_target] = f"""\t\t{app_target} /* LitterLog */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {app_config_list} /* Build configuration list for PBXNativeTarget "LitterLog" */;
\t\t\tbuildPhases = (
\t\t\t\t{app_sources_phase} /* Sources */,
\t\t\t\t{app_frameworks_phase} /* Frameworks */,
\t\t\t\t{app_resources_phase} /* Resources */,
\t\t\t\t{app_embed_phase} /* Embed Foundation Extensions */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t\t{target_dependency} /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = LitterLog;
\t\t\tproductName = LitterLog;
\t\t\tproductReference = {app_product} /* LitterLog.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t}};
"""
    objects[widget_target] = f"""\t\t{widget_target} /* LitterLogWidget */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {widget_config_list} /* Build configuration list for PBXNativeTarget "LitterLogWidget" */;
\t\t\tbuildPhases = (
\t\t\t\t{widget_sources_phase} /* Sources */,
\t\t\t\t{widget_frameworks_phase} /* Frameworks */,
\t\t\t\t{widget_resources_phase} /* Resources */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = LitterLogWidget;
\t\t\tproductName = LitterLogWidget;
\t\t\tproductReference = {widget_product} /* LitterLogWidget.appex */;
\t\t\tproductType = "com.apple.product-type.app-extension";
\t\t}};
"""
    app_for_tests_proxy = uid("proxy:app-for-tests")
    app_for_tests_dep = uid("dependency:app-for-tests")
    objects[app_for_tests_proxy] = (
        f"\t\t{app_for_tests_proxy} /* PBXContainerItemProxy */ = {{\n"
        f"\t\t\tisa = PBXContainerItemProxy;\n"
        f"\t\t\tcontainerPortal = {project_id} /* Project object */;\n"
        f"\t\t\tproxyType = 1;\n"
        f"\t\t\tremoteGlobalIDString = {app_target};\n"
        f"\t\t\tremoteInfo = LitterLog;\n"
        f"\t\t}};\n"
    )
    objects[app_for_tests_dep] = (
        f"\t\t{app_for_tests_dep} /* PBXTargetDependency */ = {{\n"
        f"\t\t\tisa = PBXTargetDependency;\n"
        f"\t\t\ttarget = {app_target} /* LitterLog */;\n"
        f"\t\t\ttargetProxy = {app_for_tests_proxy} /* PBXContainerItemProxy */;\n"
        f"\t\t}};\n"
    )

    objects[tests_target] = f"""\t\t{tests_target} /* LitterLogTests */ = {{
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = {tests_config_list} /* Build configuration list for PBXNativeTarget "LitterLogTests" */;
\t\t\tbuildPhases = (
\t\t\t\t{tests_sources_phase} /* Sources */,
\t\t\t\t{tests_frameworks_phase} /* Frameworks */,
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t\t{app_for_tests_dep} /* PBXTargetDependency */,
\t\t\t);
\t\t\tname = LitterLogTests;
\t\t\tproductName = LitterLogTests;
\t\t\tproductReference = {tests_product} /* LitterLogTests.xctest */;
\t\t\tproductType = "com.apple.product-type.bundle.unit-test";
\t\t}};
"""

    objects[project_id] = f"""\t\t{project_id} /* Project object */ = {{
\t\t\tisa = PBXProject;
\t\t\tattributes = {{
\t\t\t\tBuildIndependentTargetsInParallel = 1;
\t\t\t\tLastSwiftUpdateCheck = 1500;
\t\t\t\tLastUpgradeCheck = 1500;
\t\t\t\tTargetAttributes = {{
\t\t\t\t\t{app_target} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t}};
\t\t\t\t\t{widget_target} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t}};
\t\t\t\t\t{tests_target} = {{
\t\t\t\t\t\tCreatedOnToolsVersion = 15.0;
\t\t\t\t\t\tTestTargetID = {app_target};
\t\t\t\t\t}};
\t\t\t\t}};
\t\t\t}};
\t\t\tbuildConfigurationList = {project_config_list} /* Build configuration list for PBXProject "LitterLog" */;
\t\t\tcompatibilityVersion = "Xcode 14.0";
\t\t\tdevelopmentRegion = en;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\ten,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = {root_group};
\t\t\tproductRefGroup = {products_group} /* Products */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
\t\t\t\t{app_target} /* LitterLog */,
\t\t\t\t{widget_target} /* LitterLogWidget */,
\t\t\t\t{tests_target} /* LitterLogTests */,
\t\t\t);
\t\t}};
"""

    def config(oid: str, name: str, settings: dict[str, str]) -> None:
        lines = []
        for key, value in settings.items():
            if value.startswith("("):
                lines.append(f"\t\t\t\t{key} = {value};")
            else:
                lines.append(f"\t\t\t\t{key} = {value};")
        body = "\n".join(lines)
        objects[oid] = (
            f"\t\t{oid} /* {name} */ = {{\n\t\t\tisa = XCBuildConfiguration;\n"
            f"\t\t\tbuildSettings = {{\n{body}\n\t\t\t}};\n\t\t\tname = {name};\n\t\t}};\n"
        )

    config(project_debug, "Debug", {
        "ALWAYS_SEARCH_USER_PATHS": "NO",
        "CLANG_ENABLE_MODULES": "YES",
        "COPY_PHASE_STRIP": "NO",
        "DEBUG_INFORMATION_FORMAT": "dwarf",
        "ENABLE_TESTABILITY": "YES",
        "GCC_OPTIMIZATION_LEVEL": "0",
        "GCC_PREPROCESSOR_DEFINITIONS": '("DEBUG=1", "$(inherited)", )',
        "IPHONEOS_DEPLOYMENT_TARGET": "17.0",
        "ONLY_ACTIVE_ARCH": "YES",
        "SDKROOT": "iphoneos",
        "SWIFT_ACTIVE_COMPILATION_CONDITIONS": "DEBUG",
        "SWIFT_OPTIMIZATION_LEVEL": '"-Onone"',
    })
    config(project_release, "Release", {
        "ALWAYS_SEARCH_USER_PATHS": "NO",
        "CLANG_ENABLE_MODULES": "YES",
        "COPY_PHASE_STRIP": "NO",
        "DEBUG_INFORMATION_FORMAT": '"dwarf-with-dsym"',
        "IPHONEOS_DEPLOYMENT_TARGET": "17.0",
        "SDKROOT": "iphoneos",
        "SWIFT_COMPILATION_MODE": "wholemodule",
        "VALIDATE_PRODUCT": "YES",
    })

    app_settings = {
        "ASSETCATALOG_COMPILER_APPICON_NAME": "AppIcon",
        "ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME": "AccentColor",
        "CODE_SIGN_ENTITLEMENTS": "LitterLog/LitterLog.entitlements",
        "CODE_SIGN_STYLE": "Automatic",
        "CURRENT_PROJECT_VERSION": "1",
        "DEVELOPMENT_TEAM": '""',
        "ENABLE_PREVIEWS": "YES",
        "GENERATE_INFOPLIST_FILE": "NO",
        "INFOPLIST_FILE": "LitterLog/Info.plist",
        "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks", )',
        "MARKETING_VERSION": "1.0",
        "PRODUCT_BUNDLE_IDENTIFIER": "com.harrycarlisle.LitterLog",
        "PRODUCT_NAME": '"$(TARGET_NAME)"',
        "SUPPORTED_PLATFORMS": '"iphoneos iphonesimulator"',
        "SUPPORTS_MACCATALYST": "NO",
        "SWIFT_VERSION": "5.0",
        "TARGETED_DEVICE_FAMILY": "1",
    }
    config(app_debug, "Debug", app_settings)
    config(app_release, "Release", app_settings)

    widget_settings = {
        "CODE_SIGN_ENTITLEMENTS": "LitterLogWidget/LitterLogWidget.entitlements",
        "CODE_SIGN_STYLE": "Automatic",
        "CURRENT_PROJECT_VERSION": "1",
        "DEVELOPMENT_TEAM": '""',
        "GENERATE_INFOPLIST_FILE": "NO",
        "INFOPLIST_FILE": "LitterLogWidget/Info.plist",
        "LD_RUNPATH_SEARCH_PATHS": '("$(inherited)", "@executable_path/Frameworks", "@executable_path/../../Frameworks", )',
        "MARKETING_VERSION": "1.0",
        "PRODUCT_BUNDLE_IDENTIFIER": "com.harrycarlisle.LitterLog.Widget",
        "PRODUCT_NAME": '"$(TARGET_NAME)"',
        "SKIP_INSTALL": "YES",
        "SUPPORTED_PLATFORMS": '"iphoneos iphonesimulator"',
        "SWIFT_VERSION": "5.0",
        "TARGETED_DEVICE_FAMILY": "1",
    }
    config(widget_debug, "Debug", widget_settings)
    config(widget_release, "Release", widget_settings)

    test_settings = {
        "BUNDLE_LOADER": '"$(TEST_HOST)"',
        "CODE_SIGN_STYLE": "Automatic",
        "CURRENT_PROJECT_VERSION": "1",
        "DEVELOPMENT_TEAM": '""',
        "GENERATE_INFOPLIST_FILE": "YES",
        "MARKETING_VERSION": "1.0",
        "PRODUCT_BUNDLE_IDENTIFIER": "com.harrycarlisle.LitterLog.Tests",
        "PRODUCT_NAME": '"$(TARGET_NAME)"',
        "SUPPORTED_PLATFORMS": '"iphoneos iphonesimulator"',
        "SWIFT_VERSION": "5.0",
        "TARGETED_DEVICE_FAMILY": "1",
        "TEST_HOST": '"$(BUILT_PRODUCTS_DIR)/LitterLog.app/$(BUNDLE_EXECUTABLE_FOLDER_PATH)/LitterLog"',
    }
    config(tests_debug, "Debug", test_settings)
    config(tests_release, "Release", test_settings)

    def config_list(oid: str, label: str, debug_id: str, release_id: str) -> None:
        objects[oid] = (
            f"\t\t{oid} /* Build configuration list for {label} */ = {{\n"
            f"\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n"
            f"\t\t\t\t{debug_id} /* Debug */,\n\t\t\t\t{release_id} /* Release */,\n"
            f"\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n"
            f"\t\t\tdefaultConfigurationName = Release;\n\t\t}};\n"
        )

    config_list(project_config_list, 'PBXProject "LitterLog"', project_debug, project_release)
    config_list(app_config_list, 'PBXNativeTarget "LitterLog"', app_debug, app_release)
    config_list(widget_config_list, 'PBXNativeTarget "LitterLogWidget"', widget_debug, widget_release)
    config_list(tests_config_list, 'PBXNativeTarget "LitterLogTests"', tests_debug, tests_release)

    # Assemble pbxproj with sections
    def section(title: str, predicate) -> str:
        items = [body for oid, body in objects.items() if predicate(body)]
        return f"/* Begin {title} section */\n" + "".join(sorted(items)) + f"/* End {title} section */\n\n"

    text = "// !$*UTF8*$!\n{\n\tarchiveVersion = 1;\n\tclasses = {\n\t};\n\tobjectVersion = 56;\n\tobjects = {\n\n"
    text += section("PBXBuildFile", lambda b: "isa = PBXBuildFile" in b)
    text += section("PBXContainerItemProxy", lambda b: "isa = PBXContainerItemProxy" in b)
    text += section("PBXCopyFilesBuildPhase", lambda b: "isa = PBXCopyFilesBuildPhase" in b)
    text += section("PBXFileReference", lambda b: "isa = PBXFileReference" in b)
    text += section("PBXFrameworksBuildPhase", lambda b: "isa = PBXFrameworksBuildPhase" in b)
    text += section("PBXGroup", lambda b: "isa = PBXGroup" in b)
    text += section("PBXNativeTarget", lambda b: "isa = PBXNativeTarget" in b)
    text += section("PBXProject", lambda b: "isa = PBXProject" in b)
    text += section("PBXResourcesBuildPhase", lambda b: "isa = PBXResourcesBuildPhase" in b)
    text += section("PBXSourcesBuildPhase", lambda b: "isa = PBXSourcesBuildPhase" in b)
    text += section("PBXTargetDependency", lambda b: "isa = PBXTargetDependency" in b)
    text += section("XCBuildConfiguration", lambda b: "isa = XCBuildConfiguration" in b)
    text += section("XCConfigurationList", lambda b: "isa = XCConfigurationList" in b)
    text += f"\t}};\n\trootObject = {project_id} /* Project object */;\n}}\n"

    PROJECT.parent.mkdir(parents=True, exist_ok=True)
    PROJECT.write_text(text)
    print(f"Wrote {PROJECT}")
    print(f"Objects: {len(objects)}")
    print(f"App source files: {len(app_source_builds)}")
    print(f"Widget source files: {len(widget_source_builds)}")
    print(f"Test source files: {len(test_source_builds)}")


if __name__ == "__main__":
    main()
