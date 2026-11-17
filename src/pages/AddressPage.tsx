import ActivityIndicator from '@components/ActivityIndicator';
import AddressForm from '@components/AddressForm';
import DelegateNoAccessWrapper from '@components/DelegateNoAccessWrapper';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import ScreenWrapper from '@components/ScreenWrapper';

import useGeographicalStateAndCountryFromRoute from '@hooks/useGeographicalStateAndCountryFromRoute';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';

import {getCountryCode} from '@libs/CountryUtils';
import Navigation from '@libs/Navigation/Navigation';
import type {BackToParams} from '@libs/Navigation/types';

import type {FormOnyxValues} from '@src/components/Form/types';
import type {Country} from '@src/CONST';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import INPUT_IDS from '@src/types/form/HomeAddressForm';
import type {Address} from '@src/types/onyx/PrivatePersonalDetails';

import type {OnyxEntry} from 'react-native-onyx';

import React, {useEffect, useRef, useState} from 'react';
import {View} from 'react-native';

type AddressPageProps = {
    /** User's private personal details */
    address?: Address;
    isLoadingApp: OnyxEntry<boolean>;
    /** Function to call when address form is submitted */
    updateAddress: (values: FormOnyxValues<typeof ONYXKEYS.FORMS.HOME_ADDRESS_FORM>) => void;
    title: string;

    /**
     * When true, the underlying AddressForm also requires the zip/postal code. Used by callers
     * that need a complete address (e.g. workspace addresses backing homeAndOffice exclusions).
     */
    shouldRequireZip?: boolean;

    defaultCountry?: Country;
} & BackToParams;

function AddressPage({title, address, updateAddress, isLoadingApp = true, backTo, defaultCountry, shouldRequireZip}: AddressPageProps) {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const {state: stateFromUrl, country: countryFromUrl} = useGeographicalStateAndCountryFromRoute();

    // Check if country is valid
    const {street} = address ?? {};
    const [street1, legacyStreet2] = street ? street.split('\n') : [undefined, undefined];
    // nullish coalescing cannot be used if explicit line 2 can be an empty string
    const street2 = address?.street2 || legacyStreet2;
    const [currentCountry, setCurrentCountry] = useState(address?.country ?? defaultCountry);
    // State URL parameters are US state codes, including when navigation reuses an already open address page.
    const country = stateFromUrl ? CONST.COUNTRY.US : currentCountry;
    const [state, setState] = useState(stateFromUrl ?? address?.state);
    const [city, setCity] = useState(address?.city);
    const [zipcode, setZipcode] = useState(address?.zip);
    // The selectors consume URL parameters, but their values and subsequent edits must survive saved data arriving later.
    const hasEditedAddress = useRef(!!(stateFromUrl || countryFromUrl));

    useEffect(() => {
        if (!address || hasEditedAddress.current) {
            return;
        }
        setState(address.state);
        setCurrentCountry(address.country);
        setCity(address.city);
        setZipcode(address.zip);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address?.state, address?.country, address?.city, address?.zip]);

    const handleAddressChange = (value: unknown, key: unknown) => {
        const addressPart = value as string;
        const addressPartKey = key as keyof Address;

        if (addressPartKey !== INPUT_IDS.COUNTRY && addressPartKey !== INPUT_IDS.STATE && addressPartKey !== INPUT_IDS.CITY && addressPartKey !== INPUT_IDS.ZIP_POST_CODE) {
            return;
        }
        hasEditedAddress.current = true;
        if (addressPartKey === INPUT_IDS.COUNTRY) {
            if (addressPart !== currentCountry) {
                setCurrentCountry(getCountryCode(addressPart) ?? '');
                setState('');
                setCity('');
                setZipcode('');
            }
            return;
        }
        if (addressPartKey === INPUT_IDS.STATE) {
            if (stateFromUrl) {
                setCurrentCountry(CONST.COUNTRY.US);
            }
            setState(addressPart);
            setCity('');
            setZipcode('');
            return;
        }
        if (addressPartKey === INPUT_IDS.CITY) {
            setCity(addressPart);
            setZipcode('');
            return;
        }
        setZipcode(addressPart);
    };

    return (
        <ScreenWrapper
            enableEdgeToEdgeBottomSafeAreaPadding
            testID="AddressPage"
        >
            <DelegateNoAccessWrapper accessDeniedVariants={[CONST.DELEGATE.DENIED_ACCESS_VARIANTS.DELEGATE]}>
                <HeaderWithBackButton
                    title={title}
                    shouldShowBackButton
                    onBackButtonPress={() => Navigation.goBack(backTo)}
                />
                {isLoadingApp ? (
                    <View style={[styles.flex1, styles.fullScreenLoading]}>
                        <ActivityIndicator size={CONST.ACTIVITY_INDICATOR_SIZE.LARGE} />
                    </View>
                ) : (
                    <AddressForm
                        formID={ONYXKEYS.FORMS.HOME_ADDRESS_FORM}
                        onSubmit={updateAddress}
                        submitButtonText={translate('common.save')}
                        city={city}
                        country={country}
                        onAddressChanged={handleAddressChange}
                        state={state}
                        street1={street1}
                        street2={street2}
                        zip={zipcode}
                        shouldRequireZip={shouldRequireZip}
                    />
                )}
            </DelegateNoAccessWrapper>
        </ScreenWrapper>
    );
}

export default AddressPage;
