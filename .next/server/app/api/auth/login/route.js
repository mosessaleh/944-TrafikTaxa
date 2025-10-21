"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/auth/login/route";
exports.ids = ["app/api/auth/login/route"];
exports.modules = {

/***/ "@prisma/client":
/*!*********************************!*\
  !*** external "@prisma/client" ***!
  \*********************************/
/***/ ((module) => {

module.exports = require("@prisma/client");

/***/ }),

/***/ "bcrypt":
/*!*************************!*\
  !*** external "bcrypt" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("bcrypt");

/***/ }),

/***/ "../../client/components/action-async-storage.external":
/*!*******************************************************************************!*\
  !*** external "next/dist/client/components/action-async-storage.external.js" ***!
  \*******************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/action-async-storage.external.js");

/***/ }),

/***/ "../../client/components/request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "../../client/components/static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

module.exports = require("stream");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

module.exports = require("util");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!**********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \**********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_moses_Projects_Websites_944_Trafik_app_api_auth_login_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/auth/login/route.ts */ \"(rsc)/./app/api/auth/login/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/auth/login/route\",\n        pathname: \"/api/auth/login\",\n        filename: \"route\",\n        bundlePath: \"app/api/auth/login/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\moses\\\\Projects\\\\Websites\\\\944 Trafik\\\\app\\\\api\\\\auth\\\\login\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_moses_Projects_Websites_944_Trafik_app_api_auth_login_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/auth/login/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZhdXRoJTJGbG9naW4lMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmF1dGglMkZsb2dpbiUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmF1dGglMkZsb2dpbiUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNtb3NlcyU1Q1Byb2plY3RzJTVDV2Vic2l0ZXMlNUM5NDQlMjBUcmFmaWslNUNhcHAmcGFnZUV4dGVuc2lvbnM9dHN4JnBhZ2VFeHRlbnNpb25zPXRzJnBhZ2VFeHRlbnNpb25zPWpzeCZwYWdlRXh0ZW5zaW9ucz1qcyZyb290RGlyPUMlM0ElNUNVc2VycyU1Q21vc2VzJTVDUHJvamVjdHMlNUNXZWJzaXRlcyU1Qzk0NCUyMFRyYWZpayZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7O0FBQXNHO0FBQ3ZDO0FBQ2M7QUFDaUM7QUFDOUc7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLGdIQUFtQjtBQUMzQztBQUNBLGNBQWMseUVBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxpRUFBaUU7QUFDekU7QUFDQTtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUN1SDs7QUFFdkgiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly85NDQtdHJhZmlrLz80OWQ0Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9mdXR1cmUvcm91dGUta2luZFwiO1xuaW1wb3J0IHsgcGF0Y2hGZXRjaCBhcyBfcGF0Y2hGZXRjaCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL2xpYi9wYXRjaC1mZXRjaFwiO1xuaW1wb3J0ICogYXMgdXNlcmxhbmQgZnJvbSBcIkM6XFxcXFVzZXJzXFxcXG1vc2VzXFxcXFByb2plY3RzXFxcXFdlYnNpdGVzXFxcXDk0NCBUcmFmaWtcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXGxvZ2luXFxcXHJvdXRlLnRzXCI7XG4vLyBXZSBpbmplY3QgdGhlIG5leHRDb25maWdPdXRwdXQgaGVyZSBzbyB0aGF0IHdlIGNhbiB1c2UgdGhlbSBpbiB0aGUgcm91dGVcbi8vIG1vZHVsZS5cbmNvbnN0IG5leHRDb25maWdPdXRwdXQgPSBcIlwiXG5jb25zdCByb3V0ZU1vZHVsZSA9IG5ldyBBcHBSb3V0ZVJvdXRlTW9kdWxlKHtcbiAgICBkZWZpbml0aW9uOiB7XG4gICAgICAgIGtpbmQ6IFJvdXRlS2luZC5BUFBfUk9VVEUsXG4gICAgICAgIHBhZ2U6IFwiL2FwaS9hdXRoL2xvZ2luL3JvdXRlXCIsXG4gICAgICAgIHBhdGhuYW1lOiBcIi9hcGkvYXV0aC9sb2dpblwiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvYXV0aC9sb2dpbi9yb3V0ZVwiXG4gICAgfSxcbiAgICByZXNvbHZlZFBhZ2VQYXRoOiBcIkM6XFxcXFVzZXJzXFxcXG1vc2VzXFxcXFByb2plY3RzXFxcXFdlYnNpdGVzXFxcXDk0NCBUcmFmaWtcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXGxvZ2luXFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9hdXRoL2xvZ2luL3JvdXRlXCI7XG5mdW5jdGlvbiBwYXRjaEZldGNoKCkge1xuICAgIHJldHVybiBfcGF0Y2hGZXRjaCh7XG4gICAgICAgIHNlcnZlckhvb2tzLFxuICAgICAgICBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlXG4gICAgfSk7XG59XG5leHBvcnQgeyByb3V0ZU1vZHVsZSwgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MsIG9yaWdpbmFsUGF0aG5hbWUsIHBhdGNoRmV0Y2gsICB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1hcHAtcm91dGUuanMubWFwIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/auth/login/route.ts":
/*!*************************************!*\
  !*** ./app/api/auth/login/route.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   POST: () => (/* binding */ POST)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var zod__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! zod */ \"(rsc)/./node_modules/zod/v3/types.js\");\n/* harmony import */ var _lib_db__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/db */ \"(rsc)/./lib/db.ts\");\n/* harmony import */ var _lib_auth__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/auth */ \"(rsc)/./lib/auth.ts\");\n\n\n\n\nconst Schema = zod__WEBPACK_IMPORTED_MODULE_3__.object({\n    email: zod__WEBPACK_IMPORTED_MODULE_3__.string().email(),\n    password: zod__WEBPACK_IMPORTED_MODULE_3__.string().min(8)\n});\nasync function POST(req) {\n    const { email, password } = Schema.parse(await req.json());\n    const user = await _lib_db__WEBPACK_IMPORTED_MODULE_1__.prisma.user.findUnique({\n        where: {\n            email\n        }\n    });\n    if (!user) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        ok: false,\n        error: \"Invalid credentials\"\n    }, {\n        status: 401\n    });\n    const ok = await (0,_lib_auth__WEBPACK_IMPORTED_MODULE_2__.comparePassword)(password, user.hashedPassword);\n    if (!ok) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        ok: false,\n        error: \"Invalid credentials\"\n    }, {\n        status: 401\n    });\n    const token = (0,_lib_auth__WEBPACK_IMPORTED_MODULE_2__.signToken)({\n        id: user.id,\n        role: user.role\n    });\n    const res = next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        ok: true,\n        role: user.role,\n        next: \"/\"\n    });\n    const secure = String(process.env.COOKIE_SECURE || \"false\").toLowerCase() === \"true\";\n    res.cookies.set(\"session\", token, {\n        httpOnly: true,\n        secure,\n        sameSite: \"lax\",\n        path: \"/\",\n        maxAge: 60 * 60 * 24 * 7\n    });\n    return res;\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2F1dGgvbG9naW4vcm91dGUudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFBMkM7QUFDbkI7QUFDVTtBQUNzQjtBQUV4RCxNQUFNSyxTQUFTSix1Q0FBUSxDQUFDO0lBQUVNLE9BQU9OLHVDQUFRLEdBQUdNLEtBQUs7SUFBSUUsVUFBVVIsdUNBQVEsR0FBR1MsR0FBRyxDQUFDO0FBQUc7QUFFMUUsZUFBZUMsS0FBS0MsR0FBWTtJQUNyQyxNQUFNLEVBQUVMLEtBQUssRUFBRUUsUUFBUSxFQUFFLEdBQUdKLE9BQU9RLEtBQUssQ0FBQyxNQUFNRCxJQUFJRSxJQUFJO0lBQ3ZELE1BQU1DLE9BQU8sTUFBTWIsMkNBQU1BLENBQUNhLElBQUksQ0FBQ0MsVUFBVSxDQUFDO1FBQUVDLE9BQU87WUFBRVY7UUFBTTtJQUFFO0lBQzdELElBQUksQ0FBQ1EsTUFBTSxPQUFPZixxREFBWUEsQ0FBQ2MsSUFBSSxDQUFDO1FBQUVJLElBQUc7UUFBT0MsT0FBTTtJQUFzQixHQUFHO1FBQUVDLFFBQU87SUFBSTtJQUM1RixNQUFNRixLQUFLLE1BQU1mLDBEQUFlQSxDQUFDTSxVQUFVTSxLQUFLTSxjQUFjO0lBQzlELElBQUksQ0FBQ0gsSUFBSSxPQUFPbEIscURBQVlBLENBQUNjLElBQUksQ0FBQztRQUFFSSxJQUFHO1FBQU9DLE9BQU07SUFBc0IsR0FBRztRQUFFQyxRQUFPO0lBQUk7SUFDMUYsTUFBTUUsUUFBUWxCLG9EQUFTQSxDQUFDO1FBQUVtQixJQUFJUixLQUFLUSxFQUFFO1FBQUVDLE1BQU1ULEtBQUtTLElBQUk7SUFBQztJQUN2RCxNQUFNQyxNQUFNekIscURBQVlBLENBQUNjLElBQUksQ0FBQztRQUFFSSxJQUFHO1FBQU1NLE1BQU1ULEtBQUtTLElBQUk7UUFBRUUsTUFBTTtJQUFJO0lBQ3BFLE1BQU1DLFNBQVNDLE9BQU9DLFFBQVFDLEdBQUcsQ0FBQ0MsYUFBYSxJQUFFLFNBQVNDLFdBQVcsT0FBTztJQUM1RVAsSUFBSVEsT0FBTyxDQUFDQyxHQUFHLENBQUMsV0FBV1osT0FBTztRQUFFYSxVQUFTO1FBQU1SO1FBQVFTLFVBQVM7UUFBT0MsTUFBSztRQUFLQyxRQUFPLEtBQUcsS0FBRyxLQUFHO0lBQUU7SUFDdkcsT0FBT2I7QUFDVCIsInNvdXJjZXMiOlsid2VicGFjazovLzk0NC10cmFmaWsvLi9hcHAvYXBpL2F1dGgvbG9naW4vcm91dGUudHM/NGYyNCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVzcG9uc2UgfSBmcm9tICduZXh0L3NlcnZlcic7XG5pbXBvcnQgeyB6IH0gZnJvbSAnem9kJztcbmltcG9ydCB7IHByaXNtYSB9IGZyb20gJ0AvbGliL2RiJztcbmltcG9ydCB7IGNvbXBhcmVQYXNzd29yZCwgc2lnblRva2VuIH0gZnJvbSAnQC9saWIvYXV0aCc7XG5cbmNvbnN0IFNjaGVtYSA9IHoub2JqZWN0KHsgZW1haWw6IHouc3RyaW5nKCkuZW1haWwoKSwgcGFzc3dvcmQ6IHouc3RyaW5nKCkubWluKDgpIH0pO1xuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gUE9TVChyZXE6IFJlcXVlc3Qpe1xuICBjb25zdCB7IGVtYWlsLCBwYXNzd29yZCB9ID0gU2NoZW1hLnBhcnNlKGF3YWl0IHJlcS5qc29uKCkpO1xuICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZFVuaXF1ZSh7IHdoZXJlOiB7IGVtYWlsIH0gfSk7XG4gIGlmICghdXNlcikgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgb2s6ZmFsc2UsIGVycm9yOidJbnZhbGlkIGNyZWRlbnRpYWxzJyB9LCB7IHN0YXR1czo0MDEgfSk7XG4gIGNvbnN0IG9rID0gYXdhaXQgY29tcGFyZVBhc3N3b3JkKHBhc3N3b3JkLCB1c2VyLmhhc2hlZFBhc3N3b3JkKTtcbiAgaWYgKCFvaykgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgb2s6ZmFsc2UsIGVycm9yOidJbnZhbGlkIGNyZWRlbnRpYWxzJyB9LCB7IHN0YXR1czo0MDEgfSk7XG4gIGNvbnN0IHRva2VuID0gc2lnblRva2VuKHsgaWQ6IHVzZXIuaWQsIHJvbGU6IHVzZXIucm9sZSB9KTtcbiAgY29uc3QgcmVzID0gTmV4dFJlc3BvbnNlLmpzb24oeyBvazp0cnVlLCByb2xlOiB1c2VyLnJvbGUsIG5leHQ6ICcvJyB9KTtcbiAgY29uc3Qgc2VjdXJlID0gU3RyaW5nKHByb2Nlc3MuZW52LkNPT0tJRV9TRUNVUkV8fCdmYWxzZScpLnRvTG93ZXJDYXNlKCkgPT09ICd0cnVlJztcbiAgcmVzLmNvb2tpZXMuc2V0KCdzZXNzaW9uJywgdG9rZW4sIHsgaHR0cE9ubHk6dHJ1ZSwgc2VjdXJlLCBzYW1lU2l0ZTonbGF4JywgcGF0aDonLycsIG1heEFnZTo2MCo2MCoyNCo3IH0pO1xuICByZXR1cm4gcmVzO1xufVxuIl0sIm5hbWVzIjpbIk5leHRSZXNwb25zZSIsInoiLCJwcmlzbWEiLCJjb21wYXJlUGFzc3dvcmQiLCJzaWduVG9rZW4iLCJTY2hlbWEiLCJvYmplY3QiLCJlbWFpbCIsInN0cmluZyIsInBhc3N3b3JkIiwibWluIiwiUE9TVCIsInJlcSIsInBhcnNlIiwianNvbiIsInVzZXIiLCJmaW5kVW5pcXVlIiwid2hlcmUiLCJvayIsImVycm9yIiwic3RhdHVzIiwiaGFzaGVkUGFzc3dvcmQiLCJ0b2tlbiIsImlkIiwicm9sZSIsInJlcyIsIm5leHQiLCJzZWN1cmUiLCJTdHJpbmciLCJwcm9jZXNzIiwiZW52IiwiQ09PS0lFX1NFQ1VSRSIsInRvTG93ZXJDYXNlIiwiY29va2llcyIsInNldCIsImh0dHBPbmx5Iiwic2FtZVNpdGUiLCJwYXRoIiwibWF4QWdlIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/auth/login/route.ts\n");

/***/ }),

/***/ "(rsc)/./lib/auth.ts":
/*!*********************!*\
  !*** ./lib/auth.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   comparePassword: () => (/* binding */ comparePassword),\n/* harmony export */   getUserFromCookie: () => (/* binding */ getUserFromCookie),\n/* harmony export */   hashPassword: () => (/* binding */ hashPassword),\n/* harmony export */   signToken: () => (/* binding */ signToken)\n/* harmony export */ });\n/* harmony import */ var next_headers__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/headers */ \"(rsc)/./node_modules/next/dist/api/headers.js\");\n/* harmony import */ var _lib_db__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @/lib/db */ \"(rsc)/./lib/db.ts\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! jsonwebtoken */ \"(rsc)/./node_modules/jsonwebtoken/index.js\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(jsonwebtoken__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var bcrypt__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! bcrypt */ \"bcrypt\");\n/* harmony import */ var bcrypt__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(bcrypt__WEBPACK_IMPORTED_MODULE_3__);\n\n\n\n\nconst SECRET = process.env.SECRET || \"dev_secret_change_me\";\nfunction signToken(payload) {\n    // صلاحية أسبوع\n    return (0,jsonwebtoken__WEBPACK_IMPORTED_MODULE_2__.sign)(payload, SECRET, {\n        expiresIn: \"7d\"\n    });\n}\nasync function hashPassword(password) {\n    const saltRounds = 10;\n    return bcrypt__WEBPACK_IMPORTED_MODULE_3___default().hash(password, saltRounds);\n}\nasync function comparePassword(plain, hashed) {\n    return bcrypt__WEBPACK_IMPORTED_MODULE_3___default().compare(plain, hashed);\n}\n// تُستخدم داخل مسارات API/صفحات السيرفر للحصول على المستخدم الحالي من كوكي session\nasync function getUserFromCookie() {\n    const token = (0,next_headers__WEBPACK_IMPORTED_MODULE_0__.cookies)().get(\"session\")?.value;\n    if (!token) return null;\n    try {\n        const dec = (0,jsonwebtoken__WEBPACK_IMPORTED_MODULE_2__.verify)(token, SECRET);\n        const user = await _lib_db__WEBPACK_IMPORTED_MODULE_1__.prisma.user.findUnique({\n            where: {\n                id: dec.id\n            }\n        });\n        return user;\n    } catch  {\n        return null;\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvYXV0aC50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQXVDO0FBQ0w7QUFDVTtBQUNoQjtBQUU1QixNQUFNSyxTQUFTQyxRQUFRQyxHQUFHLENBQUNGLE1BQU0sSUFBSTtBQUU5QixTQUFTRyxVQUFVQyxPQUE0QjtJQUNwRCxlQUFlO0lBQ2YsT0FBT1Asa0RBQUlBLENBQUNPLFNBQVNKLFFBQVE7UUFBRUssV0FBVztJQUFLO0FBQ2pEO0FBRU8sZUFBZUMsYUFBYUMsUUFBZ0I7SUFDakQsTUFBTUMsYUFBYTtJQUNuQixPQUFPVCxrREFBVyxDQUFDUSxVQUFVQztBQUMvQjtBQUVPLGVBQWVFLGdCQUFnQkMsS0FBYSxFQUFFQyxNQUFjO0lBQ2pFLE9BQU9iLHFEQUFjLENBQUNZLE9BQU9DO0FBQy9CO0FBRUEsbUZBQW1GO0FBQzVFLGVBQWVFO0lBQ3BCLE1BQU1DLFFBQVFwQixxREFBT0EsR0FBR3FCLEdBQUcsQ0FBQyxZQUFZQztJQUN4QyxJQUFJLENBQUNGLE9BQU8sT0FBTztJQUNuQixJQUFHO1FBQ0QsTUFBTUcsTUFBV3BCLG9EQUFNQSxDQUFDaUIsT0FBT2Y7UUFDL0IsTUFBTW1CLE9BQU8sTUFBTXZCLDJDQUFNQSxDQUFDdUIsSUFBSSxDQUFDQyxVQUFVLENBQUM7WUFBRUMsT0FBTztnQkFBRUMsSUFBSUosSUFBSUksRUFBRTtZQUFDO1FBQUU7UUFDbEUsT0FBT0g7SUFDVCxFQUFDLE9BQUs7UUFDSixPQUFPO0lBQ1Q7QUFDRiIsInNvdXJjZXMiOlsid2VicGFjazovLzk0NC10cmFmaWsvLi9saWIvYXV0aC50cz9iZjdlIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGNvb2tpZXMgfSBmcm9tICduZXh0L2hlYWRlcnMnO1xuaW1wb3J0IHsgcHJpc21hIH0gZnJvbSAnQC9saWIvZGInO1xuaW1wb3J0IHsgc2lnbiwgdmVyaWZ5IH0gZnJvbSAnanNvbndlYnRva2VuJztcbmltcG9ydCBiY3J5cHQgZnJvbSAnYmNyeXB0JztcblxuY29uc3QgU0VDUkVUID0gcHJvY2Vzcy5lbnYuU0VDUkVUIHx8ICdkZXZfc2VjcmV0X2NoYW5nZV9tZSc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduVG9rZW4ocGF5bG9hZDogUmVjb3JkPHN0cmluZywgYW55Pil7XG4gIC8vINi12YTYp9it2YrYqSDYo9iz2KjZiNi5XG4gIHJldHVybiBzaWduKHBheWxvYWQsIFNFQ1JFVCwgeyBleHBpcmVzSW46ICc3ZCcgfSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBoYXNoUGFzc3dvcmQocGFzc3dvcmQ6IHN0cmluZyl7XG4gIGNvbnN0IHNhbHRSb3VuZHMgPSAxMDtcbiAgcmV0dXJuIGJjcnlwdC5oYXNoKHBhc3N3b3JkLCBzYWx0Um91bmRzKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNvbXBhcmVQYXNzd29yZChwbGFpbjogc3RyaW5nLCBoYXNoZWQ6IHN0cmluZyl7XG4gIHJldHVybiBiY3J5cHQuY29tcGFyZShwbGFpbiwgaGFzaGVkKTtcbn1cblxuLy8g2KrZj9iz2KrYrtiv2YUg2K/Yp9iu2YQg2YXYs9in2LHYp9iqIEFQSS/YtdmB2K3Yp9iqINin2YTYs9mK2LHZgdixINmE2YTYrdi12YjZhCDYudmE2Ykg2KfZhNmF2LPYqtiu2K/ZhSDYp9mE2K3Yp9mE2Yog2YXZhiDZg9mI2YPZiiBzZXNzaW9uXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VXNlckZyb21Db29raWUoKXtcbiAgY29uc3QgdG9rZW4gPSBjb29raWVzKCkuZ2V0KCdzZXNzaW9uJyk/LnZhbHVlO1xuICBpZiAoIXRva2VuKSByZXR1cm4gbnVsbDtcbiAgdHJ5e1xuICAgIGNvbnN0IGRlYzogYW55ID0gdmVyaWZ5KHRva2VuLCBTRUNSRVQpO1xuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBwcmlzbWEudXNlci5maW5kVW5pcXVlKHsgd2hlcmU6IHsgaWQ6IGRlYy5pZCB9IH0pO1xuICAgIHJldHVybiB1c2VyO1xuICB9Y2F0Y2h7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJjb29raWVzIiwicHJpc21hIiwic2lnbiIsInZlcmlmeSIsImJjcnlwdCIsIlNFQ1JFVCIsInByb2Nlc3MiLCJlbnYiLCJzaWduVG9rZW4iLCJwYXlsb2FkIiwiZXhwaXJlc0luIiwiaGFzaFBhc3N3b3JkIiwicGFzc3dvcmQiLCJzYWx0Um91bmRzIiwiaGFzaCIsImNvbXBhcmVQYXNzd29yZCIsInBsYWluIiwiaGFzaGVkIiwiY29tcGFyZSIsImdldFVzZXJGcm9tQ29va2llIiwidG9rZW4iLCJnZXQiLCJ2YWx1ZSIsImRlYyIsInVzZXIiLCJmaW5kVW5pcXVlIiwid2hlcmUiLCJpZCJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/auth.ts\n");

/***/ }),

/***/ "(rsc)/./lib/db.ts":
/*!*******************!*\
  !*** ./lib/db.ts ***!
  \*******************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   prisma: () => (/* binding */ prisma)\n/* harmony export */ });\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @prisma/client */ \"@prisma/client\");\n/* harmony import */ var _prisma_client__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_prisma_client__WEBPACK_IMPORTED_MODULE_0__);\n\nconst globalForPrisma = global;\nconst prisma = globalForPrisma.prisma || new _prisma_client__WEBPACK_IMPORTED_MODULE_0__.PrismaClient();\nif (true) globalForPrisma.prisma = prisma;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9saWIvZGIudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQThDO0FBQzlDLE1BQU1DLGtCQUFrQkM7QUFDakIsTUFBTUMsU0FBU0YsZ0JBQWdCRSxNQUFNLElBQUksSUFBSUgsd0RBQVlBLEdBQUc7QUFDbkUsSUFBSUksSUFBeUIsRUFBYyxnQkFBeUJELE1BQU0sR0FBR0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly85NDQtdHJhZmlrLy4vbGliL2RiLnRzPzFkZjAiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgUHJpc21hQ2xpZW50IH0gZnJvbSAnQHByaXNtYS9jbGllbnQnO1xuY29uc3QgZ2xvYmFsRm9yUHJpc21hID0gZ2xvYmFsIGFzIHVua25vd24gYXMgeyBwcmlzbWE6IFByaXNtYUNsaWVudCB9O1xuZXhwb3J0IGNvbnN0IHByaXNtYSA9IGdsb2JhbEZvclByaXNtYS5wcmlzbWEgfHwgbmV3IFByaXNtYUNsaWVudCgpO1xuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIChnbG9iYWxGb3JQcmlzbWEgYXMgYW55KS5wcmlzbWEgPSBwcmlzbWE7XG4iXSwibmFtZXMiOlsiUHJpc21hQ2xpZW50IiwiZ2xvYmFsRm9yUHJpc21hIiwiZ2xvYmFsIiwicHJpc21hIiwicHJvY2VzcyJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./lib/db.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/semver","vendor-chunks/jsonwebtoken","vendor-chunks/lodash.includes","vendor-chunks/jws","vendor-chunks/lodash.once","vendor-chunks/jwa","vendor-chunks/lodash.isinteger","vendor-chunks/ecdsa-sig-formatter","vendor-chunks/lodash.isplainobject","vendor-chunks/ms","vendor-chunks/lodash.isstring","vendor-chunks/lodash.isnumber","vendor-chunks/lodash.isboolean","vendor-chunks/safe-buffer","vendor-chunks/buffer-equal-constant-time","vendor-chunks/zod"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944%20Trafik&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();