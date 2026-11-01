import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./tests/ui',workers:1,timeout:60000,use:{browserName:'chromium',headless:true,viewport:{width:1280,height:900}},reporter:'list'});
