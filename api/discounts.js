import catalog from '../src/worker.mjs';
export default {fetch:request => catalog.fetch(request,process.env)};
