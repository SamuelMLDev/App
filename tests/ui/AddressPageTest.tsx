import {act, render, screen} from '@testing-library/react-native';

import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';

import {CurrentReportIDContextProvider} from '@hooks/useCurrentReportID';

import Navigation, {navigationRef} from '@libs/Navigation/Navigation';
import createPlatformStackNavigator from '@libs/Navigation/PlatformStackNavigation/createPlatformStackNavigator';
import type {SettingsNavigatorParamList} from '@libs/Navigation/types';

import PersonalAddressPage from '@pages/settings/Profile/PersonalDetails/PersonalAddressPage';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import SCREENS from '@src/SCREENS';

import {PortalProvider} from '@gorhom/portal';
import {NavigationContainer} from '@react-navigation/native';
import Onyx from 'react-native-onyx';

import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

jest.mock('@rnmapbox/maps', () => {
    return {
        default: jest.fn(),
        MarkerView: jest.fn(),
        setAccessToken: jest.fn(),
    };
});

const Stack = createPlatformStackNavigator<SettingsNavigatorParamList>();

const renderPage = (initialRouteName: typeof SCREENS.SETTINGS.PROFILE.ADDRESS, initialParams?: SettingsNavigatorParamList[typeof SCREENS.SETTINGS.PROFILE.ADDRESS]) => {
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider, CurrentReportIDContextProvider]}>
            <PortalProvider>
                <NavigationContainer ref={navigationRef}>
                    <Stack.Navigator initialRouteName={initialRouteName}>
                        <Stack.Screen
                            name={SCREENS.SETTINGS.PROFILE.ADDRESS}
                            component={PersonalAddressPage}
                            initialParams={initialParams}
                        />
                    </Stack.Navigator>
                </NavigationContainer>
            </PortalProvider>
        </ComposeProviders>,
    );
};

describe('AddressPageTest', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
        });

        await act(async () => {
            await Onyx.set(ONYXKEYS.NVP_PREFERRED_LOCALE, CONST.LOCALES.EN);
        });
        await waitForBatchedUpdatesWithAct();
    });

    it.each([
        {country: 'US', state: 'CA'},
        {country: 'AR', state: 'Buenos Aires'},
    ] as const)('should apply the state URL parameter to a saved $country address', async (savedAddress) => {
        // Given a saved address whose state differs from the US state requested in the URL
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: [{...savedAddress, street: '123 Test St'}]});
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, false);
        });
        await waitForBatchedUpdatesWithAct();

        // When the address page opens directly with a state parameter, including for a saved address outside the US
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS, {state: 'MO'});
        await waitForBatchedUpdatesWithAct();

        // Then the US state picker is available and the URL selection wins over the saved address
        expect(screen.getByText('United States')).toBeOnTheScreen();
        expect(screen.getByText('Missouri')).toBeOnTheScreen();
        expect(screen.queryByLabelText('State / Province')).not.toBeOnTheScreen();
    });

    it.each([false, true])('should preserve the state URL parameter when saved data arrives with app loading initially %s', async (isLoadingApp) => {
        // Given a hard load before the saved address is available and a default country outside the US
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: []});
            await Onyx.set(ONYXKEYS.COUNTRY, 'VN');
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, isLoadingApp);
        });
        await waitForBatchedUpdatesWithAct();
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS, {state: 'MO'});
        await waitForBatchedUpdatesWithAct();

        // When the saved address arrives, either before or after the form has mounted
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: [{country: 'AR', state: 'Buenos Aires', street: '123 Test St'}]});
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, false);
        });
        await waitForBatchedUpdatesWithAct();

        // Then loading saved data cannot replace the country and state requested by the link
        expect(screen.getByText('United States')).toBeOnTheScreen();
        expect(screen.getByText('Missouri')).toBeOnTheScreen();
    });

    it('should apply a state URL parameter when the address page is already open outside the US', async () => {
        // Given an open address form whose saved country does not mount the US state picker
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: [{country: 'AR', state: 'Buenos Aires', street: '123 Test St'}]});
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, false);
        });
        await waitForBatchedUpdatesWithAct();
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS);
        await waitForBatchedUpdatesWithAct();

        // When navigation updates the existing page instead of mounting it again
        act(() => Navigation.setParams({state: 'MO'}));
        await waitForBatchedUpdatesWithAct();

        // Then the US picker consumes the new value and keeps it after the URL parameter is cleared
        expect(screen.getByText('United States')).toBeOnTheScreen();
        expect(screen.getByText('Missouri')).toBeOnTheScreen();
    });

    it('should apply country and state URL parameters together', async () => {
        // Given a saved address outside the US, both selectors must receive the new address values
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: [{country: 'AR', state: 'Buenos Aires', street: '123 Test St'}]});
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, false);
        });
        await waitForBatchedUpdatesWithAct();

        // When the link supplies both a country and a state
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS, {country: 'US', state: 'MO'});
        await waitForBatchedUpdatesWithAct();

        // Then applying the country must not discard the requested state
        expect(screen.getByText('United States')).toBeOnTheScreen();
        expect(screen.getByText('Missouri')).toBeOnTheScreen();
    });

    it('should allow a country selection after applying the state URL parameter', async () => {
        // Given an address link that has selected a US state
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: [{country: 'US', state: 'CA', street: '123 Test St'}]});
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, false);
        });
        await waitForBatchedUpdatesWithAct();
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS, {state: 'MO'});
        await waitForBatchedUpdatesWithAct();
        expect(screen.getByText('Missouri')).toBeOnTheScreen();

        // When the user returns from the country picker with a new country
        act(() => Navigation.setParams({country: 'CA'}));
        await waitForBatchedUpdatesWithAct();

        // Then the consumed link cannot force the form back to the US or restore Missouri
        expect(screen.getByText('Canada')).toBeOnTheScreen();
        expect(screen.getByLabelText('State / Province')).toHaveProp('value', '');
        expect(screen.queryByText('Missouri')).not.toBeOnTheScreen();
    });

    it.each([undefined, {state: 'ASDF', country: 'XX'}])('should load the saved address when the route has no valid overrides: %s', async (initialParams) => {
        // Given an address page opened before its saved data arrives, with no usable URL values
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: []});
            await Onyx.set(ONYXKEYS.COUNTRY, 'US');
            await Onyx.set(ONYXKEYS.IS_LOADING_APP, false);
        });
        await waitForBatchedUpdatesWithAct();
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS, initialParams);
        await waitForBatchedUpdatesWithAct();

        // When the saved address arrives, normal initialization must still run
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: [{country: 'VN', state: 'Test province', street: '123 Test St'}]});
        });
        await waitForBatchedUpdatesWithAct();

        // Then invalid or absent URL parameters leave the saved country and province available
        expect(screen.getByText('Vietnam')).toBeOnTheScreen();
        expect(screen.getByLabelText('State / Province')).toHaveProp('value', 'Test province');
    });

    it('should not reset state', async () => {
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.PRIVATE_PERSONAL_DETAILS}`, {
                addresses: [
                    {
                        state: 'Test',
                        country: 'VN',
                        street: 'Test',
                    },
                ],
            });
            await Onyx.merge(`${ONYXKEYS.IS_LOADING_APP}`, false);
        });

        await waitForBatchedUpdatesWithAct();

        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS);

        await waitForBatchedUpdatesWithAct();
        const stateInput = screen.getByLabelText('State / Province');
        expect(stateInput.props.value).toEqual('Test');
        Navigation.setParams({
            country: 'VN',
        });
        await waitForBatchedUpdatesWithAct();
        const stateInputAfterParams = screen.getByLabelText('State / Province');
        expect(stateInputAfterParams.props.value).toEqual('Test');
    });

    it('should prefill address line 2 from explicit street2', async () => {
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.PRIVATE_PERSONAL_DETAILS}`, {
                addresses: [
                    {
                        country: 'US',
                        street: '123 Main St\nLegacy Suite',
                        street2: 'Suite 500',
                    },
                ],
            });
            await Onyx.merge(`${ONYXKEYS.IS_LOADING_APP}`, false);
        });

        await waitForBatchedUpdatesWithAct();

        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS);

        await waitForBatchedUpdatesWithAct();
        expect(screen.getByDisplayValue('Suite 500')).toBeDefined();
    });

    it('should prefill address line 2 from legacy newline when street2 is missing', async () => {
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.merge(`${ONYXKEYS.PRIVATE_PERSONAL_DETAILS}`, {
                addresses: [
                    {
                        country: 'US',
                        street: '123 Main St\nLegacy Suite',
                    },
                ],
            });
            await Onyx.merge(`${ONYXKEYS.IS_LOADING_APP}`, false);
        });

        await waitForBatchedUpdatesWithAct();

        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS);

        await waitForBatchedUpdatesWithAct();
        expect(screen.getByDisplayValue('Legacy Suite')).toBeDefined();
    });

    it('should default the country to the IP-derived country code', async () => {
        // Given no saved address and a valid country code detected from the IP address
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: []});
            await Onyx.set(ONYXKEYS.COUNTRY, 'CA');
        });
        await waitForBatchedUpdatesWithAct();

        // When the page mounts
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS);
        await waitForBatchedUpdatesWithAct();

        // Then the detected country is preselected
        expect(screen.getByText('Canada')).toBeOnTheScreen();
    });

    it('should leave the country empty when the IP-derived value is not a country code', async () => {
        // Given no saved address and a detected value that is not a known country, so it must not reach the country picker as a country
        await TestHelper.signInWithTestUser();
        await act(async () => {
            await Onyx.set(ONYXKEYS.PRIVATE_PERSONAL_DETAILS, {addresses: []});
            await Onyx.set(ONYXKEYS.COUNTRY, 'Not a country');
        });
        await waitForBatchedUpdatesWithAct();

        // When the page mounts
        renderPage(SCREENS.SETTINGS.PROFILE.ADDRESS);
        await waitForBatchedUpdatesWithAct();

        // Then no country is preselected and the raw value is not shown
        expect(screen.getByLabelText('Address line 1')).toBeOnTheScreen();
        expect(screen.queryByText(/Not a country/)).not.toBeOnTheScreen();
        expect(screen.queryByText('United States')).not.toBeOnTheScreen();
    });
});
