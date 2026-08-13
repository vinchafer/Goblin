# Merged remote branches deleted on 2026-08-13

Act-2 closing hygiene, Unit 5. Every branch below was fully contained in
`origin/master` at deletion time (`git branch -r --merged origin/master`), so
nothing is lost — the commits are in master. Any one of them is restorable with:

```
git push origin <sha>:refs/heads/<name>
```

`origin/master` at deletion: `458eda65d964ed7baac38766fd0aafde886054ef`

**Deliberately NOT deleted:** `claude/publish-abuse-scan-phase3-tlc5qb` (merged, but it is the branch this session's
standing instructions name as the development branch — keeping it costs nothing) and every
UNMERGED branch. The unmerged ones are listed at the bottom untouched, because "stale" and
"unmerged" are different facts and only the founder knows which of them still matter.

## Deleted (44)

| branch | tip sha |
|---|---|
| `akt2-phase15-roundtrip` | `85420d724c863d00131572427c8fc22502887f0d` |
| `branding/logos-icons` | `75682fd442dddf43125afd8f596fe2bbbc9568ea` |
| `claude/about-manifesto-pages-0ork1e` | `3ec12f460cd6e9a7c77d43d3bdb79db6c97784c8` |
| `claude/admin-api-key-mismatch-um4qrz` | `62cadcede4f764c81f71b4c4bb4c78444c33bfb7` |
| `claude/akt-2-phase-2-5-vjl1kt` | `2c096ce49b1d08c2a7a6802908446372ad3702a8` |
| `claude/akt-2-phase-2-6roa0q` | `d9a42880f4a2391aae70487619c2075a05a153b8` |
| `claude/console-authorization-coherence-70bwtj` | `491d88eb979a5ad95ce94f8c0819210b9b53ed68` |
| `claude/dd-code-audit-ty53m2` | `8bc474f3e5f2636381575b5baf2910f187ef5cd8` |
| `claude/dd-hardening-refund-resilience-41h713` | `9a7b53fd35c90b43d095a8196c11a66bc819eac9` |
| `claude/dg-generation-beauty-xpa1js` | `e9ff25f397fa1e5df4c7e1b647e993ae6230a5c8` |
| `claude/fix-c7-c8-console-honesty` | `fb9f09e98746cd268043db7d6d239b52d0a803ff` |
| `claude/fix-prompt-n5r99c` | `13d1b2907239a9843619e7efd3d05dec3d52d4b5` |
| `claude/founder-walk-1-srdrp9` | `4d4e2a3c8aef62cefd65dfab6c982bb013a0a5bd` |
| `claude/founder-walk-2-dmtl7v` | `9c4ef9f6f39933f0f6c8c3c05d9f947a601d8274` |
| `claude/founder-walk-3-swhu66` | `eb53cd95564bd3711537ee6576a1864bf32bdbdd` |
| `claude/goblin-act2-operator-identity-o8cdmk` | `61dd141d8bc0309d7c707170fc9185e9ef842fc6` |
| `claude/goblin-env-parser-hardening-o8cdmk` | `3165190dec27497ab6b2e4b9cc0bbe408dee3872` |
| `claude/goblin-founder-404-diagnosis-o8cdmk` | `c475467ce0b540ca07e68cc3a7b62695e915fa94` |
| `claude/goblin-ops-auth-e2e-publish-v9yz7x` | `c4b02393c1de5a89b2534e55bc7b141090591080` |
| `claude/goblin-ops-founder-debug-o8cdmk` | `8f3cead1da994158421b3f3e23cb9e0802c1dec0` |
| `claude/idempotency-balance-zero-5m27qt` | `a2595acb597db10343dc8625fce05bd3d568b5b4` |
| `claude/landing-safe-area-i18n-7o7rcx` | `46172f42dca82fff93495f0f926ed6ff41a5d83d` |
| `claude/launch-assist-bbbq5s` | `2d77ed794a670e0c3a3a3a06f8de7402fefa3bf0` |
| `claude/lock-screen-admin-insight-t0ldfw` | `0283fc6811d861a9381be0316e8527f72156b818` |
| `claude/lock-screen-deleted-at-bugs-9a08kn` | `5785d8679341f12aede3682c7b3d30ced83494d2` |
| `claude/money-suites-env-hardening-myq4nk` | `83f64a6739a05884cf90dd6bd2fa8d2d47272fa6` |
| `claude/new-session-3vh3fk` | `7f352cdb26a761c6742036a04b668733251ee9f5` |
| `claude/new-session-ljy1mh` | `4f348c991e82100720596fd89b794c3a0d64d435` |
| `claude/new-session-v1kwv5` | `f9f7ea89489b3684ecdcf8449999ca89d75602e6` |
| `claude/new-session-xyartf` | `108d52e2ce9828a1095d28bf5e0ca4a44be76955` |
| `claude/overnight-fix-ooswtl` | `6686629b1b53303e4cd37295ed2eb5db487eb490` |
| `claude/phase-0-fajk2w` | `4c0a3cedef9f7bde242cc8c548d6f52f6246d2cd` |
| `claude/phase-1-j5z1az` | `569a4af11cda6b15f79df89c170bf9684ac19910` |
| `claude/phase2-founder-window-e2e-1tehmn` | `9392b2e0bb8a7dbb1a98bf21454a67f044bd0e09` |
| `claude/pwa-bottom-safe-area-sftws4` | `1086d18a84bbaba96e8dfe07d559ac4f22446d24` |
| `claude/pwa-icon-flat-gold-mark-f6ye8b` | `ce8fd3b934f51519ef945c68ef8c6cac603de7b8` |
| `claude/r2-eu-jurisdiction-binding-e2l7mq` | `c616539889b28c6700f658f6def48fa2b32550c6` |
| `claude/titel-wave-c-m9p942` | `ca3000bb193a4159d7a276640f676efe85caca03` |
| `claude/wave-b-ubk7rq` | `b955f6a692d0de9319d43126a1e2dab41694b837` |
| `claude/wave-final-polish-goblin-nfyldc` | `0aaab21ba5cfd43982a7f9c8be7bfd4bc90638ed` |
| `claude/wave-h-cr9hpz` | `7532c27a2fe05a61aae2cef1fe70db57f03bc6ef` |
| `claude/worker-provision-binding-diagnosis-38j0cu` | `aefe455a5b66a4713915037069c907d13b13bb22` |
| `wave-b-build` | `8c676c4f2e2cd3b323e2a81b11c95cdfaa8ad348` |
| `wave-e-build` | `4dafeef891c3f87019ee23e754ecdb2047a2e285` |

## Left alone — UNMERGED (32)

Not stale by any test this session can apply. Listed so the founder can decide.

- `claude/cloud-rider-v2-launch-g0pmca`
- `claude/f40-resumable-runs-czgx0g`
- `claude/feeling-walk-2-evidence-fth9oz`
- `claude/fix-wave-1-truth-1j3211`
- `claude/fix-wave-2-truth-rest-ops-h3hri4`
- `claude/fix-wave-3-theme-flow-ya3o6s`
- `claude/fix-wave-4-agent-model-w7x57g`
- `claude/fix-wave-5-polish-7uaxyi`
- `claude/goblin-docs-housekeeping-1hd5ed`
- `claude/help-e2e-fix`
- `claude/landing-page-fixes-7tqyrh`
- `claude/launch-readiness-audit-spr8at`
- `claude/speed-haptics-spike-mak70d`
- `claude/vercel-silent-config-tzah3p`
- `claude/walk-2-evidence-ixi5ii`
- `claude/wave-a-speed-design-rm1wby`
- `claude/wave-d-security-7whp2y`
- `claude/wave-e-gbnq14`
- `claude/wave-g-74prft`
- `claude/wave-i-insight-cw85pk`
- `claude/wave-i-insight-vy36w0`
- `claude/wave-k-safety-layers-rr5u07`
- `claude/webhook-hardening-3edkfc`
- `dd-hardening-2026-06-20`
- `feel-sprint-1-2026-07-02`
- `feel-sprint-2-2026-07-03`
- `l2-api-first-pivot`
- `onboarding-and-fixes-2026-07-02`
- `plan-change-existing-sub-2026-06-25`
- `product-fixes-2026-06-21`
- `track1-reland-2026-06-26`
- `walk-fixes-2026-06-21`
