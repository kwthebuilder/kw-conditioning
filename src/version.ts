/**
 * Version strings shown on the settings screen and in every export
 * (app_build_plan_v1.md §6). The spec name is a constant because the
 * markdown spec has no machine-readable version field; the config and
 * vector versions are read from the files by the loader.
 */
export const APP_VERSION: string = __APP_VERSION__;
export const SPEC_NAME = 'engine_spec_v1_6' as const;
