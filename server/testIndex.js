const chai = require("chai");
const sinonChai = require("sinon-chai");
const chaiSubset = require("chai-subset");

chai.use(sinonChai);
chai.use(chaiSubset);

const compilerOptions = require("./tsconfig.json").compilerOptions;
compilerOptions.noEmitOnError = false;
compilerOptions.module = "commonjs";
require("ts-node").register({
    fast: true,
    noProject: true,
    compilerOptions: compilerOptions
});