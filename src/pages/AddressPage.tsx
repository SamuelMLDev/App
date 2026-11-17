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

import {useIsFocused} from '@react-navigation/native';
import React, {useEffect, useState} from 'react';
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
    const isFocused = useIsFocused();

    // Check if country is valid
    const {street} = address ?? {};
    const [street1, legacyStreet2] = street ? street.split('\n') : [undefined, undefined];
    // nullish coalescing cannot be used if explicit line 2 can be an empty string
    const street2 = address?.street2 || legacyStreet2;
    const [selectedCountry, setSelectedCountry] = useState<Country | ''>();
    const [selectedState, setSelectedState] = useState<string>();
    const [selectedCity, setSelectedCity] = useState<string>();
    const [selectedZipcode, setSelectedZipcode] = useState<string>();
    const [countryForStateParameter, setCountryForStateParameter] = useState(stateFromUrl ? countryFromUrl : undefined);

    // The country selector can consume its parameter before the state parameter is cleared.
    if (stateFromUrl && countryFromUrl && countryFromUrl !== countryForStateParameter) {
        setCountryForStateParameter(countryFromUrl);
    } else if (!stateFromUrl && countryForStateParameter) {
        setCountryForStateParameter(undefined);
    }

    const savedCountry = address?.country ?? defaultCountry;
    const currentCountry = selectedCountry ?? savedCountry;
    // State URL parameters are US codes, but an explicit country takes precedence over an incompatible state.
    const country = countryFromUrl ?? (stateFromUrl ? (countryForStateParameter ?? CONST.COUNTRY.US) : currentCountry);
    const shouldUseSavedFields = country === savedCountry;
    const state = country === CONST.COUNTRY.US && stateFromUrl ? stateFromUrl : (selectedState ?? (shouldUseSavedFields ? address?.state : ''));
    const city = selectedCity ?? (shouldUseSavedFields ? address?.city : '');
    const zipcode = selectedZipcode ?? (shouldUseSavedFields ? address?.zip : '');

    useEffect(() => {
        if (!isFocused || !stateFromUrl || !countryForStateParameter || countryForStateParameter === CONST.COUNTRY.US) {
            return;
        }
        // The US selector is absent for this country, so it cannot consume the inapplicable state parameter.
        Navigation.setParams({state: undefined});
    }, [stateFromUrl, countryForStateParameter, isFocused]);

    const updateAddressFields = (value: unknown, key: unknown) => {
        const addressPart = value as string;
        const addressPartKey = key as keyof Address;

        if (addressPartKey !== INPUT_IDS.COUNTRY && addressPartKey !== INPUT_IDS.STATE && addressPartKey !== INPUT_IDS.CITY && addressPartKey !== INPUT_IDS.ZIP_POST_CODE) {
            return;
        }
        if (addressPartKey === INPUT_IDS.COUNTRY) {
            const nextCountry = getCountryCode(addressPart) ?? '';
            setSelectedCountry(nextCountry);
            if (nextCountry !== currentCountry) {
                setSelectedState('');
                setSelectedCity('');
                setSelectedZipcode('');
            }
            return;
        }
        if (addressPartKey === INPUT_IDS.STATE) {
            // Autocomplete can select country and state in one batch; retain the country its earlier callback selected.
            setSelectedCountry((previousCountry) => (stateFromUrl ? CONST.COUNTRY.US : (previousCountry ?? currentCountry)));
            setSelectedState(addressPart);
            setSelectedCity('');
            setSelectedZipcode('');
            return;
        }
        if (addressPartKey === INPUT_IDS.CITY) {
            setSelectedCity(addressPart);
            setSelectedZipcode('');
            return;
        }
        setSelectedZipcode(addressPart);
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
                        onAddressChanged={updateAddressFields}
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
