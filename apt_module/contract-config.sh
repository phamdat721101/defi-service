#!/bin/bash

profile="${1:-local}"

account_addr=$(aptos config show-profiles --profile "${profile}" | jq -r ".Result.${profile}.account")
echo "account address: ${account_addr}"

seed=leofi
echo "seed: ${seed}"

leofi_module=$(aptos account derive-resource-account-address \
  --address "${account_addr}" \
  --seed "${seed}" | grep -oE '[0-9a-fA-F]{64}' | awk '{print "0x"$1}' | head -n 1)
echo "pump address: ${leofi_module}"

echo "config before"
aptos move view --profile "${profile}" \
  --function-id "${leofi_module}::pump::get_configuration"

# example to update config
# 1% fee
# 30 APT
# 300 APT
# 1 billion
# 200 million
# 6 decimal
aptos move run --profile "${profile}" --assume-yes \
  --function-id "${leofi_module}::pump::update_config" \
  --args \
  u8:100 \
  u64:3000000000 \
  u64:30000000000 \
  u64:1000000000000000 \
  u64:200000000000000 \
  u8:6

echo "config after"
aptos move view --profile "${profile}" \
  --function-id "${leofi_module}::pump::get_configuration"
