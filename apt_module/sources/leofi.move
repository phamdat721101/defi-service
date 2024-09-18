module leofi_module::leofi_module {
    use std::error;
    use std::signer;
    use std::string;
    use std::string::String;
    use std::timestamp;
    use aptos_std::math64;
    use aptos_std::type_info;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::aptos_account;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::code;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::event;
    use aptos_framework::resource_account;

    use liquidswap_lp::lp_coin::LP;
    use liquidswap_v05::coin_helper::is_sorted;
    use liquidswap_v05::curves::Uncorrelated;
    use liquidswap_v05::liquidity_pool;
    use liquidswap_v05::router;

    #[test_only]
    use aptos_framework::account::create_account_for_test;
    #[test_only]
    use aptos_framework::aptos_coin;
    #[test_only]
    use liquidswap_v05::scripts;
    #[test_only]
    use test_helpers::test_pool;

    const EURI_TOO_LONG: u64 = 69000;
    const EDESCRIPTION_TOO_LONG: u64 = 69001;
    const ETWITTER_TOO_LONG: u64 = 69002;
    const ETELEGRAM_NAME_TOO_LONG: u64 = 69003;
    const EWEBSITE_NAME_TOO_LONG: u64 = 69004;

    const EPOOL_NOT_EXIST: u64 = 69005;
    const EPOOL_COMPLETED: u64 = 69006;
    const EOUTPUT_TOO_SMALL: u64 = 69007;
    const EMAX_INPUT_TOO_SMALL: u64 = 69008;
    const EINPUT_TOO_SMALL: u64 = 69009;
    const EMIN_OUTPUT_TOO_LARGE: u64 = 69010;
    const EEMPTY_AMOUNT_IN: u64 = 69011;
    const EINCORRECT_SWAP: u64 = 69012;
    const ENOT_ADMIN: u64 = 69013;
    const EREAL_APTOS_AMOUNT_TOO_SMALL: u64 = 69014;

    #[event]
    struct Created has drop, store {
        name: String,
        symbol: String,
        uri: String,
        description: String,
        twitter: String,
        telegram: String,
        website: String,
        token_address: String,
        bonding_curve: String,
        created_by: address,
        virtual_aptos_reserves: u64,
        virtual_token_reserves: u64,
        ts: u64
    }

    #[event]
    struct Traded has drop, store {
        is_buy: bool,
        user: address,
        token_address: String,
        aptos_amount: u64,
        token_amount: u64,
        virtual_aptos_reserves: u64,
        virtual_token_reserves: u64,
        ts: u64
    }

    #[event]
    struct ConfigChanged has drop, store {
        old_platform_fee: u8,
        new_platform_fee: u8,
        old_graduated_fee: u64,
        new_graduated_fee: u64,
        old_initial_virtual_aptos_reserves: u64,
        new_initial_virtual_aptos_reserves: u64,
        old_initial_virtual_token_reserves: u64,
        new_initial_virtual_token_reserves: u64,
        old_remain_token_reserves: u64,
        new_remain_token_reserves: u64,
        old_token_decimals: u8,
        new_token_decimals: u8,
        ts: u64
    }

    #[event]
    struct OwnershipTransferred has drop, store {
        old_admin: address,
        new_admin: address,
        ts: u64
    }

    #[event]
    struct PoolCompleted has drop, store {
        token_address: String,
        lp: String,
        ts: u64
    }

    struct Configuration has key {
        signer_cap: SignerCapability,
        admin: address,
        platform_fee: u8,
        graduated_fee: u64,
        initial_virtual_aptos_reserves: u64,
        initial_virtual_token_reserves: u64,
        remain_token_reserves: u64,
        token_decimals: u8,
    }

    struct Pool<phantom CoinType> has key {
        real_aptos_reserves: Coin<AptosCoin>,
        real_token_reserves: Coin<CoinType>,
        virtual_token_reserves: u64,
        virtual_aptos_reserves: u64,
        remain_token_reserves: Coin<CoinType>,
        is_completed: bool,
    }

    fun init_module(signer: &signer) {
        let signer_cap = resource_account::retrieve_resource_account_cap(signer, @admin_addr);
        move_to(signer, Configuration {
            signer_cap,
            admin: @admin_addr,
            platform_fee: 100, // 1%
            graduated_fee: 3_000_000_000, // 30 APT
            initial_virtual_aptos_reserves: 30_000_000_000, // 300 APT
            initial_virtual_token_reserves: 1_000_000_000_000_000, // 1 billion
            remain_token_reserves: 200_000_000_000_000, // 20 million
            token_decimals: 6,
        });
    }

    public entry fun create<CoinType>(
        sender: &signer,
        name: String,
        symbol: String,
        uri: String,
        description: String,
        twitter: String,
        telegram: String,
        website: String,
    ) acquires Configuration {
        assert!(string::length(&uri) <= 300, error::invalid_argument(EURI_TOO_LONG));
        assert!(string::length(&description) <= 1000, error::invalid_argument(EDESCRIPTION_TOO_LONG));
        assert!(string::length(&twitter) <= 500, error::invalid_argument(ETWITTER_TOO_LONG));
        assert!(string::length(&telegram) <= 500, error::invalid_argument(ETELEGRAM_NAME_TOO_LONG));
        assert!(string::length(&website) <= 500, error::invalid_argument(EWEBSITE_NAME_TOO_LONG));

        let config = borrow_global<Configuration>(@leofi_module);

        let (burn_cap, freeze_cap, mint_cap) = coin::initialize<CoinType>(
            sender,
            name,
            symbol,
            config.token_decimals,
            true,
        );

        let real_token_for_trade = coin::mint<CoinType>(
            config.initial_virtual_token_reserves - config.remain_token_reserves,
            &mint_cap
        );
        let remain_token_reserved_for_dex = coin::mint<CoinType>(
            config.remain_token_reserves,
            &mint_cap
        );

        coin::destroy_mint_cap<CoinType>(mint_cap);
        coin::destroy_burn_cap<CoinType>(burn_cap);
        coin::destroy_freeze_cap<CoinType>(freeze_cap);

        let resource_signer = account::create_signer_with_capability(&config.signer_cap);
        move_to(&resource_signer, Pool {
            real_aptos_reserves: coin::zero<AptosCoin>(),
            real_token_reserves: real_token_for_trade,
            virtual_aptos_reserves: config.initial_virtual_aptos_reserves,
            virtual_token_reserves: config.initial_virtual_token_reserves,
            remain_token_reserves: remain_token_reserved_for_dex,
            is_completed: false,
        });

        event::emit(Created {
            name,
            symbol,
            uri,
            description,
            twitter,
            telegram,
            website,
            token_address: type_info::type_name<CoinType>(),
            bonding_curve: type_info::type_name<Pool<CoinType>>(),
            created_by: signer::address_of(sender),
            virtual_aptos_reserves: config.initial_virtual_aptos_reserves,
            virtual_token_reserves: config.initial_virtual_token_reserves,
            ts: timestamp::now_microseconds(),
        });
    }

    public entry fun buy<CoinType>(sender: &signer, max_aptos_in: u64, token_out: u64) acquires Pool, Configuration {
        assert!(exists<Pool<CoinType>>(@leofi_module), EPOOL_NOT_EXIST);

        let config = borrow_global<Configuration>(@leofi_module);
        let pool = borrow_global<Pool<CoinType>>(@leofi_module);
        assert!(!pool.is_completed, EPOOL_COMPLETED);

        assert!(token_out > 0, EOUTPUT_TOO_SMALL);

        // last buy checking
        let max_virtual_token_reserves = pool.virtual_token_reserves - coin::value(&pool.remain_token_reserves);
        let token_out = math64::min(token_out, max_virtual_token_reserves);
        let aptos_needed = get_amount_in(token_out, pool.virtual_aptos_reserves, pool.virtual_token_reserves);
        let aptos_fee_amount = aptos_needed / (config.platform_fee as u64);
        assert!(max_aptos_in >= aptos_needed + aptos_fee_amount, EMAX_INPUT_TOO_SMALL);

        let (token_swapped, aptos_swapped) = swap<CoinType>(
            coin::zero<CoinType>(),
            coin::withdraw<AptosCoin>(sender, aptos_needed),
            token_out,
            0,
        );

        let sender_addr = signer::address_of(sender);
        aptos_account::deposit_coins(sender_addr, aptos_swapped); // redundancy...
        aptos_account::deposit_coins(sender_addr, token_swapped);
        aptos_account::deposit_coins(config.admin, coin::withdraw<AptosCoin>(sender, aptos_fee_amount));

        let updated_pool = borrow_global_mut<Pool<CoinType>>(@leofi_module);
        event::emit(Traded {
            is_buy: true,
            user: sender_addr,
            token_address: type_info::type_name<CoinType>(),
            aptos_amount: aptos_needed,
            token_amount: token_out,
            virtual_aptos_reserves: updated_pool.virtual_aptos_reserves,
            virtual_token_reserves: updated_pool.virtual_token_reserves,
            ts: timestamp::now_microseconds(),
        });

        if (max_virtual_token_reserves == token_out) {
            transfer_pool<CoinType>();
        }
    }

    public entry fun sell<CoinType>(sender: &signer, token_in: u64, min_aptos_out: u64) acquires Configuration, Pool {
        assert!(exists<Pool<CoinType>>(@leofi_module), EPOOL_NOT_EXIST);

        let config = borrow_global<Configuration>(@leofi_module);
        let pool = borrow_global<Pool<CoinType>>(@leofi_module);
        assert!(!pool.is_completed, EPOOL_COMPLETED);

        assert!(token_in > 0, EINPUT_TOO_SMALL);

        let aptos_out = get_amount_out(token_in, pool.virtual_token_reserves, pool.virtual_aptos_reserves);
        let aptos_fee_amount = aptos_out / (config.platform_fee as u64);
        assert!(aptos_out - aptos_fee_amount >= min_aptos_out, EMIN_OUTPUT_TOO_LARGE);

        let (token_swapped, aptos_swapped) = swap<CoinType>(
            coin::withdraw<CoinType>(sender, token_in),
            coin::zero<AptosCoin>(),
            0,
            aptos_out,
        );

        let sender_addr = signer::address_of(sender);
        aptos_account::deposit_coins(sender_addr, aptos_swapped);
        aptos_account::deposit_coins(sender_addr, token_swapped); // redundancy...
        aptos_account::deposit_coins(config.admin, coin::withdraw<AptosCoin>(sender, aptos_fee_amount));

        let updated_pool = borrow_global<Pool<CoinType>>(@leofi_module);
        event::emit(Traded {
            is_buy: false,
            user: sender_addr,
            token_address: type_info::type_name<CoinType>(),
            aptos_amount: aptos_out,
            token_amount: token_in,
            virtual_aptos_reserves: updated_pool.virtual_aptos_reserves,
            virtual_token_reserves: updated_pool.virtual_token_reserves,
            ts: timestamp::now_microseconds(),
        });
    }

    fun swap<CoinType>(
        token_in: Coin<CoinType>,
        aptos_in: Coin<AptosCoin>,
        token_out: u64,
        aptos_out: u64,
    ): (Coin<CoinType>, Coin<AptosCoin>) acquires Pool {
        assert!(coin::value(&token_in) > 0 || coin::value(&aptos_in) > 0, EEMPTY_AMOUNT_IN);

        let pool = borrow_global_mut<Pool<CoinType>>(@leofi_module);
        let (vtr_before, var_before) = (pool.virtual_token_reserves, pool.virtual_aptos_reserves);

        pool.virtual_token_reserves = pool.virtual_token_reserves - token_out;
        pool.virtual_aptos_reserves = pool.virtual_aptos_reserves - aptos_out;
        pool.virtual_token_reserves = pool.virtual_token_reserves + coin::value(&token_in);
        pool.virtual_aptos_reserves = pool.virtual_aptos_reserves + coin::value(&aptos_in);

        assert_lp_value_is_increased_or_not_changed(
            vtr_before,
            var_before,
            pool.virtual_token_reserves,
            pool.virtual_aptos_reserves
        );

        coin::merge(&mut pool.real_token_reserves, token_in);
        coin::merge(&mut pool.real_aptos_reserves, aptos_in);

        let token_swapped = coin::extract(&mut pool.real_token_reserves, token_out);
        let aptos_swapped = coin::extract(&mut pool.real_aptos_reserves, aptos_out);

        (token_swapped, aptos_swapped)
    }

    fun transfer_pool<CoinType>() acquires Pool, Configuration {
        let config = borrow_global<Configuration>(@leofi_module);
        let pool = borrow_global_mut<Pool<CoinType>>(@leofi_module);
        pool.is_completed = true;

        let aptos_fee_to_admin = coin::extract(&mut pool.real_aptos_reserves, config.graduated_fee);
        aptos_account::deposit_coins(config.admin, aptos_fee_to_admin);

        let aptos_to_transfer = coin::extract_all(&mut pool.real_aptos_reserves);
        let token_to_transfer = coin::extract_all(&mut pool.real_token_reserves);
        coin::merge(&mut token_to_transfer, coin::extract_all(&mut pool.remain_token_reserves));

        let signer = account::create_signer_with_capability(&config.signer_cap);
        if (is_sorted<CoinType, AptosCoin>()) {
            if (!liquidity_pool::is_pool_exists<CoinType, AptosCoin, Uncorrelated>()) {
                router::register_pool<CoinType, AptosCoin, Uncorrelated>(&signer);
            };
            let (token_remain, aptos_remain, lp_token) = router::add_liquidity<CoinType, AptosCoin, Uncorrelated>(
                token_to_transfer,
                1,
                aptos_to_transfer,
                1,
            );
            aptos_account::deposit_coins(@leofi_module, token_remain);
            aptos_account::deposit_coins(@leofi_module, aptos_remain);
            aptos_account::deposit_coins(@leofi_module, lp_token);
            event::emit(PoolCompleted {
                token_address: type_info::type_name<CoinType>(),
                lp: type_info::type_name<LP<CoinType, AptosCoin, Uncorrelated>>(),
                ts: timestamp::now_microseconds(),
            });
        } else {
            if (!liquidity_pool::is_pool_exists<AptosCoin, CoinType, Uncorrelated>()) {
                router::register_pool<AptosCoin, CoinType, Uncorrelated>(&signer);
            };
            let (aptos_remain, token_remain, lp_token) = router::add_liquidity<AptosCoin, CoinType, Uncorrelated>(
                aptos_to_transfer,
                1,
                token_to_transfer,
                1,
            );
            aptos_account::deposit_coins(@leofi_module, token_remain);
            aptos_account::deposit_coins(@leofi_module, aptos_remain);
            aptos_account::deposit_coins(@leofi_module, lp_token);
            event::emit(PoolCompleted {
                token_address: type_info::type_name<CoinType>(),
                lp: type_info::type_name<LP<AptosCoin, CoinType, Uncorrelated>>(),
                ts: timestamp::now_microseconds(),
            });
        }
    }

    fun assert_lp_value_is_increased_or_not_changed(
        x_res_before_swap: u64,
        y_res_before_swap: u64,
        x_res_after_swap: u64,
        y_res_after_swap: u64,
    ) {
        let lp_value_before_swap_u256 = (x_res_before_swap as u128) * (y_res_before_swap as u128);
        let lp_value_after_swap_u256 = (x_res_after_swap as u128) * (y_res_after_swap as u128);
        assert!(lp_value_before_swap_u256 <= lp_value_after_swap_u256, EINCORRECT_SWAP);
    }

    inline fun get_amount_in(
        amount_out: u64, // b
        reserve_in: u64, // x
        reserve_out: u64, // y
    ): u64 {
        //     (x * b)
        // a = -------
        //     (y - b)
        mul_div(
            reserve_in, amount_out,
            reserve_out - amount_out
        ) + 1
    }

    inline fun get_amount_out(
        amount_in: u64, // a
        reserve_in: u64, // x
        reserve_out: u64, // y
    ): u64 {
        //     (y * a)
        // b = -------
        //     (x + a)
        mul_div(
            reserve_out, amount_in,
            reserve_in + amount_in
        )
    }

    inline fun mul_div(x: u64, y: u64, z: u64): u64 {
        let r = (x as u128) * (y as u128) / (z as u128);
        (r as u64)
    }

    public entry fun transfer_admin(
        sender: &signer,
        new_admin: address, // Might need multisig?
    ) acquires Configuration {
        let config = borrow_global_mut<Configuration>(@leofi_module);
        assert!(config.admin == signer::address_of(sender), ENOT_ADMIN);
        config.admin = new_admin;
        event::emit(OwnershipTransferred {
            old_admin: signer::address_of(sender),
            new_admin,
            ts: timestamp::now_microseconds(),
        });
    }

    public entry fun update_config(
        sender: &signer,
        platform_fee: u8,
        graduated_fee: u64,
        initial_virtual_aptos_reserves: u64,
        initial_virtual_token_reserves: u64,
        remain_token_reserves: u64,
        token_decimals: u8,
    ) acquires Configuration {
        let config = borrow_global_mut<Configuration>(@leofi_module);
        assert!(config.admin == signer::address_of(sender), ENOT_ADMIN);

        let old_platform_fee = config.platform_fee;
        let old_graduated_fee = config.graduated_fee;
        let old_initial_virtual_aptos_reserves = config.initial_virtual_aptos_reserves;
        let old_initial_virtual_token_reserves = config.initial_virtual_token_reserves;
        let old_remain_token_reserves = config.remain_token_reserves;
        let old_token_decimals = config.token_decimals;

        config.platform_fee = platform_fee;
        config.graduated_fee = graduated_fee;
        config.initial_virtual_aptos_reserves = initial_virtual_aptos_reserves;
        config.initial_virtual_token_reserves = initial_virtual_token_reserves;
        config.remain_token_reserves = remain_token_reserves;
        config.token_decimals = token_decimals;

        event::emit(ConfigChanged {
            old_platform_fee,
            new_platform_fee: platform_fee,
            old_graduated_fee,
            new_graduated_fee: graduated_fee,
            old_initial_virtual_aptos_reserves,
            new_initial_virtual_aptos_reserves: initial_virtual_aptos_reserves,
            old_initial_virtual_token_reserves,
            new_initial_virtual_token_reserves: initial_virtual_token_reserves,
            old_remain_token_reserves,
            new_remain_token_reserves: remain_token_reserves,
            old_token_decimals,
            new_token_decimals: token_decimals,
            ts: timestamp::now_microseconds(),
        });
    }

    public entry fun upgrade(
        sender: &signer,
        metadata_serialized: vector<u8>,
        code: vector<vector<u8>>,
    ) acquires Configuration {
        let config = borrow_global<Configuration>(@leofi_module);
        assert!(config.admin == signer::address_of(sender), ENOT_ADMIN);
        let signer = account::create_signer_with_capability(&config.signer_cap);
        code::publish_package_txn(&signer, metadata_serialized, code);
    }

    #[view]
    public fun get_configuration(): (
        address, // admin
        u8, // platform_fee
        u64, // graduated_fee
        u64, // initial_virtual_aptos_reserves
        u64, // initial_virtual_token_reserves
        u64, // remain_token_reserves
        u8 // token_decimals
    ) acquires Configuration {
        let config = borrow_global<Configuration>(@leofi_module);
        (
            config.admin,
            config.platform_fee,
            config.graduated_fee,
            config.initial_virtual_aptos_reserves,
            config.initial_virtual_token_reserves,
            config.remain_token_reserves,
            config.token_decimals,
        )
    }

    #[view]
    public fun get_pool<CoinType>(): (
        u64, // real_token_reserves
        u64, // real_aptos_reserves
        u64, // virtual_token_reserves
        u64, // virtual_aptos_reserves
        u64, // remain_token_reserves
        bool // is_completed
    ) acquires Pool {
        let pool = borrow_global<Pool<CoinType>>(@leofi_module);
        (
            coin::value(&pool.real_token_reserves),
            coin::value(&pool.real_aptos_reserves),
            pool.virtual_token_reserves,
            pool.virtual_aptos_reserves,
            coin::value(&pool.remain_token_reserves),
            pool.is_completed,
        )
    }    
}
