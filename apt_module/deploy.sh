#!/bin/bash

network="${1:-testnet}"
profile="${2:-local}"
mode="${3:-upgrade}"

echo init new "${profile}" account at "${network}"

if [ -d .aptos ]; then
  echo "updating existing ${profile} profile..."
  output=$(echo '' | aptos init --network "${network}" --profile "${profile}" --assume-yes 2>&1 >/dev/null)
else
  echo "creating new ${profile} profile..."
  output=$(echo '' | aptos init --network "${network}" --profile "${profile}" 2>&1 >/dev/null)
fi

account_addr=$(echo "${output}" | grep -oE 'Account 0x[0-9a-fA-F]{64}' | awk '{print $2}' | head -n 1)
echo "new account address: ${account_addr}"

seed=leofi
echo "seed: ${seed}"

# it should not start with 0x0 eg:0x03972769e9753cc8d8a2b51f86edb32d3dd52c3b1ef9da7ad9f459b33d4d3f49
leofi_module=$(aptos account derive-resource-account-address \
  --address "${account_addr}" \
  --seed "${seed}" | grep -oE '[0-9a-fA-F]{64}' | awk '{print "0x"$1}' | head -n 1)

echo "pump address: ${leofi_module}"

if [ "${mode}" = "upgrade" ]; then
  echo 'upgrading...'
  aptos move build-publish-payload --json-output-file ./payload.json --assume-yes \
    --included-artifacts none \
    --named-addresses leofi_module="${leofi_module}",admin_addr="${account_addr}"
  sed -i "" "s/0x1::code::publish_package_txn/${leofi_module}::pump::upgrade/g" payload.json
  aptos move run --json-file ./payload.json --profile "${profile}" --assume-yes
  rm ./payload.json
elif [ "${mode}" = "deploy" ]; then
  echo 'deploying...'
  aptos move create-resource-account-and-publish-package \
    --profile "${profile}" \
    --seed "${seed}" \
    --address-name leofi_module \
    --included-artifacts none \
    --named-addresses admin_addr="${account_addr}" --assume-yes
fi
