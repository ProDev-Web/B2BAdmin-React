import { useCallback, useState, useMemo } from 'react';
// @ts-ignore
import { useSelector, useDispatch } from 'react-redux';
import { parse, stringify } from 'query-string';
import { push } from 'connected-react-router';
import lodashDebounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import pickBy from 'lodash/pickBy';
import { Location } from 'history';

import queryReducer, {
    SET_FILTER,
    SET_PAGE,
    SET_PER_PAGE,
    SET_SORT,
    SORT_ASC,
} from '../reducer/admin/resource/list/queryReducer';
import { changeListParams, ListParams } from '../actions/listActions';
import { Sort, ReduxState } from '../types';
import removeEmpty from '../util/removeEmpty';
import removeKey from '../util/removeKey';

interface ListParamsOptions {
    resource: string;
    location: Location;
    perPage?: number;
    sort?: Sort;
    filterDefaultValues?: object;
    debounce?: number;
}

interface Parameters extends ListParams {
    filterValues: object;
    displayedFilters: {
        [key: string]: boolean;
    };
    requestSignature: any[];
}

interface Modifiers {
    changeParams: (action: any) => void;
    setPage: (page: number) => void;
    setPerPage: (pageSize: number) => void;
    setSort: (sort: Sort) => void;
    setFilters: (filters: any) => void;
    hideFilter: (filterName: string) => void;
    showFilter: (filterName: string, defaultValue: any) => void;
}

const emptyObject = {};

const defaultSort = {
    field: 'id',
    order: SORT_ASC,
};

/**
 * Get the list parameters (page, sort, filters) and modifiers.
 *
 * These parameters are merged from 3 sources:
 *   - the query string from the URL
 *   - the params stored in the state (from previous navigation)
 *   - the options passed to the hook (including the filter defaultValues)
 *
 * @returns {Array} A tuple [parameters, modifiers].
 * Destructure as [
 *    { page, perPage, sort, order, filter, filterValues, displayedFilters, requestSignature },
 *    { setFilters, hideFilter, showFilter, setPage, setPerPage, setSort }
 * ]
 *
 * @example
 *
 * const [listParams, listParamsActions] = useListParams({
 *      resource: 'posts',
 *      location: location // From react-router. Injected to your component by react-admin inside a List
 *      filterDefaultValues: {
 *          published: true
 *      },
 *      sort: {
 *          field: 'published_at',
 *          order: 'DESC'
 *      },
 *      perPage: 25
 * });
 *
 * const {
 *      page,
 *      perPage,
 *      sort,
 *      order,
 *      filter,
 *      filterValues,
 *      displayedFilters,
 *      requestSignature
 * } = listParams;
 *
 * const {
 *      setFilters,
 *      hideFilter,
 *      showFilter,
 *      setPage,
 *      setPerPage,
 *      setSort,
 * } = listParamsActions;
 */
const useListParams = ({
    resource,
    location,
    filterDefaultValues,
    sort = defaultSort,
    perPage = 10,
    debounce = 500,
}: ListParamsOptions): [Parameters, Modifiers] => {
    const [displayedFilters, setDisplayedFilters] = useState({});
    const dispatch = useDispatch();

    const { params } = useSelector(
        (reduxState: ReduxState) => reduxState.admin.resources[resource].list,
        [resource]
    );

    const requestSignature = [
        location.search,
        resource,
        params,
        filterDefaultValues,
        JSON.stringify(sort),
        perPage,
    ];

    const query = useMemo(
        () =>
            getQuery({
                location,
                params,
                filterDefaultValues,
                sort,
                perPage,
            }),
        [filterDefaultValues, location, params, perPage, sort]
    );

    const changeParams = useCallback(
        action => {
            const newParams = queryReducer(query, action);
            dispatch(
                push({
                    search: `?${stringify({
                        ...newParams,
                        filter: JSON.stringify(newParams.filter),
                    })}`,
                })
            );
            dispatch(changeListParams(resource, newParams));
        },
        [dispatch, query, resource]
    );

    const setSort = useCallback(
        newSort => changeParams({ type: SET_SORT, payload: { sort: newSort } }),
        [changeParams]
    );

    const setPage = useCallback(
        newPage => changeParams({ type: SET_PAGE, payload: newPage }),
        [changeParams]
    );

    const setPerPage = useCallback(
        newPerPage => changeParams({ type: SET_PER_PAGE, payload: newPerPage }),
        [changeParams]
    );

    const filterValues = query.filter || emptyObject;

    const setFilters = useCallback(
        lodashDebounce(filters => {
            if (isEqual(filters, filterValues)) {
                return;
            }

            // fix for redux-form bug with onChange and enableReinitialize
            const filtersWithoutEmpty = removeEmpty(filters);
            changeParams({
                type: SET_FILTER,
                payload: filtersWithoutEmpty,
            });
        }, debounce),
        requestSignature
    );

    const hideFilter = useCallback(
        (filterName: string) => {
            setDisplayedFilters({ [filterName]: false });
            const newFilters = removeKey(filterValues, filterName);
            setFilters(newFilters);
        },
        [filterValues, setFilters]
    );

    const showFilter = useCallback(
        (filterName: string, defaultValue: any) => {
            setDisplayedFilters({ [filterName]: true });
            if (typeof defaultValue !== 'undefined') {
                setFilters({
                    ...filterValues,
                    [filterName]: defaultValue,
                });
            }
        },
        [filterValues, setFilters]
    );

    return [
        {
            displayedFilters,
            filterValues,
            requestSignature,
            ...query,
        },
        {
            changeParams,
            setPage,
            setPerPage,
            setSort,
            setFilters,
            hideFilter,
            showFilter,
        },
    ];
};

export const validQueryParams = ['page', 'perPage', 'sort', 'order', 'filter'];

export const parseQueryFromLocation = ({ search }) => {
    const query = pickBy(
        parse(search),
        (v, k) => validQueryParams.indexOf(k) !== -1
    );
    if (query.filter && typeof query.filter === 'string') {
        try {
            query.filter = JSON.parse(query.filter);
        } catch (err) {
            delete query.filter;
        }
    }
    return query;
};

/**
 * Check if user has already set custom sort, page, or filters for this list
 *
 * User params come from the Redux store as the params props. By default,
 * this object is:
 *
 * { filter: {}, order: null, page: 1, perPage: null, sort: null }
 *
 * To check if the user has custom params, we must compare the params
 * to these initial values.
 *
 * @param {object} params
 */
export const hasCustomParams = (params: ListParams) => {
    return (
        params &&
        params.filter &&
        (Object.keys(params.filter).length > 0 ||
            params.order != null ||
            params.page !== 1 ||
            params.perPage != null ||
            params.sort != null)
    );
};

/**
 * Merge list params from 3 different sources:
 *   - the query string
 *   - the params stored in the state (from previous navigation)
 *   - the props passed to the List component (including the filter defaultValues)
 */
export const getQuery = ({
    location,
    params,
    filterDefaultValues,
    sort,
    perPage,
}) => {
    const queryFromLocation = parseQueryFromLocation(location);
    const query: Partial<ListParams> =
        Object.keys(queryFromLocation).length > 0
            ? queryFromLocation
            : hasCustomParams(params)
            ? { ...params }
            : { filter: filterDefaultValues || {} };

    if (!query.sort) {
        query.sort = sort.field;
        query.order = sort.order;
    }
    if (!query.perPage) {
        query.perPage = perPage;
    }
    if (!query.page) {
        query.page = 1;
    }
    return {
        ...query,
        page: getNumberOrDefault(query.page, 1),
        perPage: getNumberOrDefault(query.perPage, 10),
    } as ListParams;
};

export const getNumberOrDefault = (
    possibleNumber: string | number | undefined,
    defaultValue: number
) =>
    (typeof possibleNumber === 'string'
        ? parseInt(possibleNumber, 10)
        : possibleNumber) || defaultValue;

export default useListParams;
