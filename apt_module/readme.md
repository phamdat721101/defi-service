1. Resource Account

```bash
$ aptos account derive-resource-account-address \
--address $ADDRESS \
--seed $SEED
```

2. Deploy

```bash
$ aptos move create-resource-account-and-publish-package \
--profile $PROFILE \
--seed $SEED \
--address-name leofi_module \
--named-addresses admin_addr=$ADMIN_ADDR
```

or

```bash
$ ./deploy.sh
```
