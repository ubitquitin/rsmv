import * as cmdts from "cmd-ts";
import { CliApiContext, cliApi } from "./clicommands";
import { cliArguments } from "./cliparser";
import { CLIScriptFS, CLIScriptOutput } from "./scriptrunner";

// Compatibility polyfill for Map.getOrInsertComputed
if (!(Map.prototype as any).getOrInsertComputed) {
    (Map.prototype as any).getOrInsertComputed = function (
        key: any,
        callback: (key: any) => any
    ) {
        if (this.has(key)) {
            return this.get(key);
        }

        const value = callback(key);
        this.set(key, value);
        return value;
    };
}

let ctx: CliApiContext = {
    getFs(fsname: string) { return new CLIScriptFS(fsname); },
    getConsole() { return new CLIScriptOutput(); }
}

let api = cliApi(ctx);

cmdts.run(api.subcommands, cliArguments());