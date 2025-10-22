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

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \**************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   originalPathname: () => (/* binding */ originalPathname),\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/future/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/future/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/future/route-kind */ \"(rsc)/./node_modules/next/dist/server/future/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var C_Users_moses_Projects_Websites_944_TrafikTaxa_app_api_auth_login_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/auth/login/route.ts */ \"(rsc)/./app/api/auth/login/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_future_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_future_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/auth/login/route\",\n        pathname: \"/api/auth/login\",\n        filename: \"route\",\n        bundlePath: \"app/api/auth/login/route\"\n    },\n    resolvedPagePath: \"C:\\\\Users\\\\moses\\\\Projects\\\\Websites\\\\944-TrafikTaxa\\\\app\\\\api\\\\auth\\\\login\\\\route.ts\",\n    nextConfigOutput,\n    userland: C_Users_moses_Projects_Websites_944_TrafikTaxa_app_api_auth_login_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nconst originalPathname = \"/api/auth/login/route\";\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        serverHooks,\n        staticGenerationAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIuanM/bmFtZT1hcHAlMkZhcGklMkZhdXRoJTJGbG9naW4lMkZyb3V0ZSZwYWdlPSUyRmFwaSUyRmF1dGglMkZsb2dpbiUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmF1dGglMkZsb2dpbiUyRnJvdXRlLnRzJmFwcERpcj1DJTNBJTVDVXNlcnMlNUNtb3NlcyU1Q1Byb2plY3RzJTVDV2Vic2l0ZXMlNUM5NDQtVHJhZmlrVGF4YSU1Q2FwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9QyUzQSU1Q1VzZXJzJTVDbW9zZXMlNUNQcm9qZWN0cyU1Q1dlYnNpdGVzJTVDOTQ0LVRyYWZpa1RheGEmaXNEZXY9dHJ1ZSZ0c2NvbmZpZ1BhdGg9dHNjb25maWcuanNvbiZiYXNlUGF0aD0mYXNzZXRQcmVmaXg9Jm5leHRDb25maWdPdXRwdXQ9JnByZWZlcnJlZFJlZ2lvbj0mbWlkZGxld2FyZUNvbmZpZz1lMzAlM0QhIiwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFzRztBQUN2QztBQUNjO0FBQ3FDO0FBQ2xIO0FBQ0E7QUFDQTtBQUNBLHdCQUF3QixnSEFBbUI7QUFDM0M7QUFDQSxjQUFjLHlFQUFTO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxZQUFZO0FBQ1osQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFFBQVEsaUVBQWlFO0FBQ3pFO0FBQ0E7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDdUg7O0FBRXZIIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vOTQ0LXRyYWZpay8/MmMwNiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLW1vZHVsZXMvYXBwLXJvdXRlL21vZHVsZS5jb21waWxlZFwiO1xuaW1wb3J0IHsgUm91dGVLaW5kIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvZnV0dXJlL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCJDOlxcXFxVc2Vyc1xcXFxtb3Nlc1xcXFxQcm9qZWN0c1xcXFxXZWJzaXRlc1xcXFw5NDQtVHJhZmlrVGF4YVxcXFxhcHBcXFxcYXBpXFxcXGF1dGhcXFxcbG9naW5cXFxccm91dGUudHNcIjtcbi8vIFdlIGluamVjdCB0aGUgbmV4dENvbmZpZ091dHB1dCBoZXJlIHNvIHRoYXQgd2UgY2FuIHVzZSB0aGVtIGluIHRoZSByb3V0ZVxuLy8gbW9kdWxlLlxuY29uc3QgbmV4dENvbmZpZ091dHB1dCA9IFwiXCJcbmNvbnN0IHJvdXRlTW9kdWxlID0gbmV3IEFwcFJvdXRlUm91dGVNb2R1bGUoe1xuICAgIGRlZmluaXRpb246IHtcbiAgICAgICAga2luZDogUm91dGVLaW5kLkFQUF9ST1VURSxcbiAgICAgICAgcGFnZTogXCIvYXBpL2F1dGgvbG9naW4vcm91dGVcIixcbiAgICAgICAgcGF0aG5hbWU6IFwiL2FwaS9hdXRoL2xvZ2luXCIsXG4gICAgICAgIGZpbGVuYW1lOiBcInJvdXRlXCIsXG4gICAgICAgIGJ1bmRsZVBhdGg6IFwiYXBwL2FwaS9hdXRoL2xvZ2luL3JvdXRlXCJcbiAgICB9LFxuICAgIHJlc29sdmVkUGFnZVBhdGg6IFwiQzpcXFxcVXNlcnNcXFxcbW9zZXNcXFxcUHJvamVjdHNcXFxcV2Vic2l0ZXNcXFxcOTQ0LVRyYWZpa1RheGFcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXGxvZ2luXFxcXHJvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuY29uc3Qgb3JpZ2luYWxQYXRobmFtZSA9IFwiL2FwaS9hdXRoL2xvZ2luL3JvdXRlXCI7XG5mdW5jdGlvbiBwYXRjaEZldGNoKCkge1xuICAgIHJldHVybiBfcGF0Y2hGZXRjaCh7XG4gICAgICAgIHNlcnZlckhvb2tzLFxuICAgICAgICBzdGF0aWNHZW5lcmF0aW9uQXN5bmNTdG9yYWdlXG4gICAgfSk7XG59XG5leHBvcnQgeyByb3V0ZU1vZHVsZSwgcmVxdWVzdEFzeW5jU3RvcmFnZSwgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MsIG9yaWdpbmFsUGF0aG5hbWUsIHBhdGNoRmV0Y2gsICB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1hcHAtcm91dGUuanMubWFwIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/auth/login/route.ts":
/*!*************************************!*\
  !*** ./app/api/auth/login/route.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   POST: () => (/* binding */ POST)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n\nasync function POST(req) {\n    // كل الكود داخل try شامل، مع استيرادات ديناميكية لمنع أخطاء وقت تحميل الملف\n    try {\n        const bodyText = await req.text();\n        let parsed;\n        try {\n            parsed = JSON.parse(bodyText || \"{}\");\n        } catch  {\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                ok: false,\n                error: \"Invalid JSON body\"\n            }, {\n                status: 400\n            });\n        }\n        // استيرادات ديناميكية داخل الهاندلر\n        const [{ z }, { prisma }, authMod, rl] = await Promise.all([\n            __webpack_require__.e(/*! import() */ \"vendor-chunks/zod\").then(__webpack_require__.bind(__webpack_require__, /*! zod */ \"(rsc)/./node_modules/zod/index.js\")),\n            __webpack_require__.e(/*! import() */ \"_rsc_lib_db_ts\").then(__webpack_require__.bind(__webpack_require__, /*! @/lib/db */ \"(rsc)/./lib/db.ts\")),\n            Promise.all(/*! import() */[__webpack_require__.e(\"vendor-chunks/next\"), __webpack_require__.e(\"vendor-chunks/semver\"), __webpack_require__.e(\"vendor-chunks/jsonwebtoken\"), __webpack_require__.e(\"vendor-chunks/lodash.includes\"), __webpack_require__.e(\"vendor-chunks/jws\"), __webpack_require__.e(\"vendor-chunks/lodash.once\"), __webpack_require__.e(\"vendor-chunks/jwa\"), __webpack_require__.e(\"vendor-chunks/lodash.isinteger\"), __webpack_require__.e(\"vendor-chunks/ecdsa-sig-formatter\"), __webpack_require__.e(\"vendor-chunks/lodash.isplainobject\"), __webpack_require__.e(\"vendor-chunks/ms\"), __webpack_require__.e(\"vendor-chunks/lodash.isstring\"), __webpack_require__.e(\"vendor-chunks/lodash.isnumber\"), __webpack_require__.e(\"vendor-chunks/lodash.isboolean\"), __webpack_require__.e(\"vendor-chunks/safe-buffer\"), __webpack_require__.e(\"vendor-chunks/buffer-equal-constant-time\"), __webpack_require__.e(\"vendor-chunks/bcryptjs\"), __webpack_require__.e(\"_rsc_lib_auth_ts\")]).then(__webpack_require__.bind(__webpack_require__, /*! @/lib/auth */ \"(rsc)/./lib/auth.ts\")),\n            Promise.all(/*! import() */[__webpack_require__.e(\"vendor-chunks/lru-cache\"), __webpack_require__.e(\"_rsc_lib_rate-limit_ts\")]).then(__webpack_require__.bind(__webpack_require__, /*! @/lib/rate-limit */ \"(rsc)/./lib/rate-limit.ts\"))\n        ]);\n        const Schema = z.object({\n            email: z.string().email(),\n            password: z.string().min(6)\n        });\n        const { email, password } = Schema.parse(parsed);\n        // Rate limit آمن\n        try {\n            await rl.limitOrThrow(\"login:\" + rl.clientIpKey(req), {\n                points: 5,\n                durationSec: 60\n            });\n        } catch (e) {\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                ok: false,\n                error: \"Too many attempts. Try again shortly.\"\n            }, {\n                status: e?.status || 429\n            });\n        }\n        // الاستعلام عن المستخدم\n        const user = await prisma.user.findFirst({\n            where: {\n                email\n            }\n        });\n        if (!user) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            ok: false,\n            error: \"Invalid email or password\"\n        }, {\n            status: 401\n        });\n        // مقارنة كلمة السر (lib/crypto مستخدم عبر lib/auth)\n        const ok = await authMod.comparePassword(password, user.hashedPassword);\n        if (!ok) return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            ok: false,\n            error: \"Invalid email or password\"\n        }, {\n            status: 401\n        });\n        // إنشاء الجلسة ككوكي\n        const token = authMod.signToken({\n            id: user.id\n        });\n        authMod.setSessionCookie(token);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            ok: true,\n            user: {\n                id: user.id,\n                email: user.email,\n                role: user.role,\n                emailVerified: user.emailVerified,\n                firstName: user.firstName,\n                lastName: user.lastName\n            }\n        });\n    } catch (e) {\n        // لوج للخادم + رد JSON دائم\n        console.error(\"[auth/login] fatal\", e?.stack || e?.message || e);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            ok: false,\n            error: \"Login failed (server)\"\n        }, {\n            status: 500\n        });\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,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YWZpay8uL2FwcC9hcGkvYXV0aC9sb2dpbi9yb3V0ZS50cz80ZjI0Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXNwb25zZSB9IGZyb20gJ25leHQvc2VydmVyJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxOiBSZXF1ZXN0KXtcbiAgLy8g2YPZhCDYp9mE2YPZiNivINiv2KfYrtmEIHRyeSDYtNin2YXZhNiMINmF2Lkg2KfYs9iq2YrYsdin2K/Yp9iqINiv2YrZhtin2YXZitmD2YrYqSDZhNmF2YbYuSDYo9iu2LfYp9ihINmI2YLYqiDYqtit2YXZitmEINin2YTZhdmE2YFcbiAgdHJ5e1xuICAgIGNvbnN0IGJvZHlUZXh0ID0gYXdhaXQgcmVxLnRleHQoKTtcbiAgICBsZXQgcGFyc2VkOiBhbnk7XG4gICAgdHJ5IHsgcGFyc2VkID0gSlNPTi5wYXJzZShib2R5VGV4dCB8fCAne30nKTsgfSBjYXRjaCB7IHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IG9rOmZhbHNlLCBlcnJvcjonSW52YWxpZCBKU09OIGJvZHknIH0sIHsgc3RhdHVzOjQwMCB9KTsgfVxuXG4gICAgLy8g2KfYs9iq2YrYsdin2K/Yp9iqINiv2YrZhtin2YXZitmD2YrYqSDYr9in2K7ZhCDYp9mE2YfYp9mG2K/ZhNixXG4gICAgY29uc3QgW3sgeiB9LCB7IHByaXNtYSB9LCBhdXRoTW9kLCBybF0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG4gICAgICBpbXBvcnQoJ3pvZCcpLFxuICAgICAgaW1wb3J0KCdAL2xpYi9kYicpLFxuICAgICAgaW1wb3J0KCdAL2xpYi9hdXRoJyksXG4gICAgICBpbXBvcnQoJ0AvbGliL3JhdGUtbGltaXQnKVxuICAgIF0pO1xuXG4gICAgY29uc3QgU2NoZW1hID0gei5vYmplY3QoeyBlbWFpbDogei5zdHJpbmcoKS5lbWFpbCgpLCBwYXNzd29yZDogei5zdHJpbmcoKS5taW4oNikgfSk7XG4gICAgY29uc3QgeyBlbWFpbCwgcGFzc3dvcmQgfSA9IFNjaGVtYS5wYXJzZShwYXJzZWQpO1xuXG4gICAgLy8gUmF0ZSBsaW1pdCDYotmF2YZcbiAgICB0cnl7IGF3YWl0IHJsLmxpbWl0T3JUaHJvdygnbG9naW46JytybC5jbGllbnRJcEtleShyZXEpLCB7IHBvaW50czogNSwgZHVyYXRpb25TZWM6IDYwIH0pOyB9IFxuICAgIGNhdGNoKGU6YW55KXsgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgb2s6ZmFsc2UsIGVycm9yOidUb28gbWFueSBhdHRlbXB0cy4gVHJ5IGFnYWluIHNob3J0bHkuJyB9LCB7IHN0YXR1czogZT8uc3RhdHVzfHw0MjkgfSk7IH1cblxuICAgIC8vINin2YTYp9iz2KrYudmE2KfZhSDYudmGINin2YTZhdiz2KrYrtiv2YVcbiAgICBjb25zdCB1c2VyID0gYXdhaXQgcHJpc21hLnVzZXIuZmluZEZpcnN0KHsgd2hlcmU6IHsgZW1haWwgfSB9KTtcbiAgICBpZiAoIXVzZXIpIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IG9rOmZhbHNlLCBlcnJvcjonSW52YWxpZCBlbWFpbCBvciBwYXNzd29yZCcgfSwgeyBzdGF0dXM6NDAxIH0pO1xuXG4gICAgLy8g2YXZgtin2LHZhtipINmD2YTZhdipINin2YTYs9ixIChsaWIvY3J5cHRvINmF2LPYqtiu2K/ZhSDYudio2LEgbGliL2F1dGgpXG4gICAgY29uc3Qgb2sgPSBhd2FpdCBhdXRoTW9kLmNvbXBhcmVQYXNzd29yZChwYXNzd29yZCwgdXNlci5oYXNoZWRQYXNzd29yZCk7XG4gICAgaWYgKCFvaykgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgb2s6ZmFsc2UsIGVycm9yOidJbnZhbGlkIGVtYWlsIG9yIHBhc3N3b3JkJyB9LCB7IHN0YXR1czo0MDEgfSk7XG5cbiAgICAvLyDYpdmG2LTYp9ihINin2YTYrNmE2LPYqSDZg9mD2YjZg9mKXG4gICAgY29uc3QgdG9rZW4gPSBhdXRoTW9kLnNpZ25Ub2tlbih7IGlkOiB1c2VyLmlkIH0pO1xuICAgIGF1dGhNb2Quc2V0U2Vzc2lvbkNvb2tpZSh0b2tlbik7XG5cbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBvazp0cnVlLCB1c2VyOiB7IGlkOnVzZXIuaWQsIGVtYWlsOnVzZXIuZW1haWwsIHJvbGU6dXNlci5yb2xlLCBlbWFpbFZlcmlmaWVkOnVzZXIuZW1haWxWZXJpZmllZCwgZmlyc3ROYW1lOnVzZXIuZmlyc3ROYW1lLCBsYXN0TmFtZTp1c2VyLmxhc3ROYW1lIH0gfSk7XG4gIH1jYXRjaChlOmFueSl7XG4gICAgLy8g2YTZiNisINmE2YTYrtin2K/ZhSArINix2K8gSlNPTiDYr9in2KbZhVxuICAgIGNvbnNvbGUuZXJyb3IoJ1thdXRoL2xvZ2luXSBmYXRhbCcsIGU/LnN0YWNrfHxlPy5tZXNzYWdlfHxlKTtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oeyBvazpmYWxzZSwgZXJyb3I6J0xvZ2luIGZhaWxlZCAoc2VydmVyKScgfSwgeyBzdGF0dXM6NTAwIH0pO1xuICB9XG59XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiUE9TVCIsInJlcSIsImJvZHlUZXh0IiwidGV4dCIsInBhcnNlZCIsIkpTT04iLCJwYXJzZSIsImpzb24iLCJvayIsImVycm9yIiwic3RhdHVzIiwieiIsInByaXNtYSIsImF1dGhNb2QiLCJybCIsIlByb21pc2UiLCJhbGwiLCJTY2hlbWEiLCJvYmplY3QiLCJlbWFpbCIsInN0cmluZyIsInBhc3N3b3JkIiwibWluIiwibGltaXRPclRocm93IiwiY2xpZW50SXBLZXkiLCJwb2ludHMiLCJkdXJhdGlvblNlYyIsImUiLCJ1c2VyIiwiZmluZEZpcnN0Iiwid2hlcmUiLCJjb21wYXJlUGFzc3dvcmQiLCJoYXNoZWRQYXNzd29yZCIsInRva2VuIiwic2lnblRva2VuIiwiaWQiLCJzZXRTZXNzaW9uQ29va2llIiwicm9sZSIsImVtYWlsVmVyaWZpZWQiLCJmaXJzdE5hbWUiLCJsYXN0TmFtZSIsImNvbnNvbGUiLCJzdGFjayIsIm1lc3NhZ2UiXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/auth/login/route.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fauth%2Flogin%2Froute&page=%2Fapi%2Fauth%2Flogin%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Flogin%2Froute.ts&appDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=C%3A%5CUsers%5Cmoses%5CProjects%5CWebsites%5C944-TrafikTaxa&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();