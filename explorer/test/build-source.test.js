import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSource,publicRepository} from '../scripts/build-source.mjs';
test('Source identity supports HTTPS, SSH and fork remotes without credentials',()=>{
 for(const remote of ['https://github.com/owner/fork.git','git@github.com:owner/fork.git','ssh://git@github.com/owner/fork.git']) assert.equal(publicRepository(remote),'https://github.com/owner/fork');
 assert.equal(publicRepository('https://secret@github.com/owner/fork.git'),null);
});
test('Archive identity requires explicit revision and dirty status',()=>{
 const env={ATLAS_SOURCE_COMMIT:'a'.repeat(40),ATLAS_SOURCE_DIRTY:'true',ATLAS_SOURCE_REPOSITORY:'git@github.com:owner/fork.git'};
 assert.deepEqual(buildSource(null,env),{commit:'a'.repeat(40),dirty:true,repository:'https://github.com/owner/fork'});
 assert.throws(()=>buildSource(null,{...env,ATLAS_SOURCE_DIRTY:undefined}));
 assert.throws(()=>buildSource(null,{...env,ATLAS_SOURCE_COMMIT:'main'}));
});
test('A tracked local checkout resolves its own identity',()=>{
 if(process.env.ATLAS_SOURCE_COMMIT)return;
 const source=buildSource(new URL('../',import.meta.url),{});
 assert.match(source.commit,/^[a-f0-9]{40}$/);
 assert.match(source.repository,/^https:\/\/github.com\//);
});
