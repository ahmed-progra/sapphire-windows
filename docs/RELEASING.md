# Publishing a release

1. Update package/lockfile versions, changelog, and download filenames.
2. On Windows, run `npm ci`, `npm test`, `npm run package:release`, and the packaged isolated test in [VERIFICATION.md](VERIFICATION.md).
3. Review the source and scan for secrets. Inspect version, native resources, notices, and Electron fuses. Do not package profiles, `.tools`, logs, or `.test-output`.
4. Hash the exact installer and ZIP:

   ```powershell
   Get-ChildItem release -File | Where-Object Extension -In '.exe','.zip' | Sort-Object Name | ForEach-Object { '{0}  {1}' -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name } | Set-Content release/SHA256SUMS.txt -Encoding ascii
   ```

5. Commit, tag `v<package-version>`, push, and confirm Windows CI for that commit.
6. Create a draft release from that tag; attach installer, ZIP, and checksums. GitHub's tag source archives supply the corresponding source snapshot.
7. Record actual checks and limitations, identify unsigned binaries, verify uploads, then publish.

The Windows workflow builds/tests every change. Manual dispatch additionally creates installer/ZIP CI artifacts; it does not publish releases. Signing needs a separately provisioned identity; never commit signing secrets.
