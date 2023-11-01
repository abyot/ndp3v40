/* Controllers */

/* global ndpFramework */


ndpFramework.controller('LLGFinanceController',
        function($scope,
        $translate,
        $modal,
        $filter,
        NotificationService,
        SelectedMenuService,
        orderByFilter,
        PeriodService,
        MetaDataFactory,
        OrgUnitFactory,
        Analytics,
        OptionComboService,
        OrgUnitGroupSetService) {

    $scope.model = {
        metaDataCached: false,
        data: null,
        reportReady: false,
        dataExists: false,
        dataHeaders: [],
        optionSetsById: [],
        optionSets: [],
        llgFinanceDataSet: null,
        llgFinanceSectors: [],
        llgFinanceFundTypes: [],
        llgFinanceWorkPlans: [],
        llgFinanceProgrammes: [],
        llgFinanceOutputs: [],
        selectedPeriod: null,
        selectedQuarters: [],
        periods: [],
        periodOffset: 0,
        openFuturePeriods: 2,
        selectedPeriodType: 'FinancialJuly',
        dataFilter: {}
    };

    $scope.model.horizontalMenus = [
        {id: 'finance', title: 'llg_finance', order: 1, view: 'components/llg/llg-finance.html', active: true, class: 'main-horizontal-menu'}
    ];

    $scope.$watch('selectedOrgUnit', function(){
        $scope.resetDataView();
        if( angular.isObject($scope.selectedOrgUnit) && $scope.selectedOrgUnit.id){
            OrgUnitGroupSetService.getByVote( $scope.selectedOrgUnit.id ).then(function(data){
                $scope.model.selectedVote = data;
            });
        }
    });

    $scope.processFilters = function( dimension ){
        if ( dimension === 'SECTOR' ){
            if ( $scope.model.dataFilter.sector ){
                var sector = $filter('getFirst')($scope.model.llgFinanceSectors, {displayName: $scope.model.dataFilter.sector}, true);
                $scope.model.workPlans = sector.categoryOptionGroups;
                $scope.model.programmes = $.map(sector.categoryOptionGroups, function(cog){return cog.categoryOptions;});
            }
            else{
                $scope.model.workPlans = angular.copy( $scope.model.llgFinanceworkPlans );
                $scope.model.sectors = angular.copy( $scope.model.llgFinanceSectors);
            }
        }
        else if ( dimension === 'WORKPLAN' ){
            if ( $scope.model.dataFilter.workPlan ){
                var wp = $scope.model.workPlanInfo[$scope.model.dataFilter.workPlan];
                $scope.model.sectors = [wp.sector];
                $scope.model.programmes = wp.programme;
            }
        }
        else if ( dimension === 'PROGRAMME' ){
            var pr = $scope.model.programmeInfo[$scope.model.dataFilter.programme];
            $scope.model.sectors = [pr.sector];
            $scope.model.workPlans = [pr.workPlan];
        }
    };

    //Get orgunits for the logged in user
    OrgUnitFactory.getViewTreeRoot().then(function(response) {
        $scope.orgUnits = response.organisationUnits;
        angular.forEach($scope.orgUnits, function(ou){
            ou.show = true;
            angular.forEach(ou.children, function(o){
                o.hasChildren = o.children && o.children.length > 0 ? true : false;
            });
        });
        $scope.selectedOrgUnit = null;

        OrgUnitGroupSetService.getByGroupOrgUnitOnly('llg').then(function(llgs){
            $scope.model.llgs = llgs;
            MetaDataFactory.getAll('categoryOptionGroupSets').then(function(cogss){
                angular.forEach(cogss, function(cogs){
                    if ( cogs.llgFinanceSector ){
                        $scope.model.llgFinanceSectors.push(cogs);
                    }
                });

                if( $scope.model.llgFinanceSectors.length === 0 ){
                    NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_llg_sector_config"));
                    return;
                }
                dhis2.ndp.downloadGroupSets( 'llgFinancialPerformance' ).then(function(){

                    MetaDataFactory.getAllByProperty('dataElementGroupSets', 'indicatorGroupSetType', 'llgFinancialPerformance').then(function(){
                        MetaDataFactory.getAll('dataSets').then(function(dss){
                            for(var i=0; i<dss.length; i++){
                                if( dss[i].dataSetType && dss[i].dataSetType === 'llgFinance' ){
                                    $scope.model.llgFinanceDataSet = dss[i];
                                }
                            }

                            if ( !$scope.model.llgFinanceDataSet ){
                                NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_llg_finance_dataset"));
                                return;
                            }

                            OptionComboService.getLlgFinanceDimensions($scope.model.llgFinanceDataSet.categoryCombo.id, $scope.model.llgFinanceSectors).then(function( dim ){
                                $scope.model.llgFinanceFundTypes = dim.fundTypes;
                                $scope.model.llgFinanceworkPlans = dim.workPlans;
                                $scope.model.workPlanInfo = dim.workPlanInfo;
                                $scope.model.llgFinanceProgrammes = dim.programmes;
                                $scope.model.llgFinanceOutputs = dim.outputs;
                                $scope.model.mappedOptionCombos = dim.optionCombos;
                                $scope.model.programmeInfo = dim.programmeInfo;

                                $scope.model.sectors = angular.copy( $scope.model.llgFinanceSectors );
                                $scope.model.workPlans = angular.copy( $scope.model.llgFinanceworkPlans );
                                $scope.model.programmes = angular.copy( $scope.model.llgFinanceProgrammes );

                                MetaDataFactory.getAll('dataElements').then(function(dataElements){

                                    $scope.model.dataElementsById = dataElements.reduce( function(map, obj){
                                        map[obj.id] = obj;
                                        return map;
                                    }, {});

                                    $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();
                                    $scope.model.periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
                                    $scope.model.metaDataCached = true;
                                });
                            });
                        });
                    });
                });
            });
        });
    });

    $scope.setSortHeader = function(header){
        $scope.reverse = ($scope.sortHeader && $scope.sortHeader.id === header.id) ? !$scope.reverse : false;
        $scope.sortHeader = header;
    };

    $scope.resetView = function(horizontalMenu){
        $scope.model.activeHorizontalMenu = horizontalMenu;
    };

    $scope.resetDataView = function(){
        $scope.model.data = null;
        $scope.model.reportReady = false;
        $scope.model.dataExists = false;
    };

    $scope.getPeriods = function(mode){
        if( mode === 'NXT'){
            $scope.model.periodOffset = $scope.model.periodOffset + 1;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }
        else{
            $scope.model.periodOffset = $scope.model.periodOffset - 1;
            $scope.model.periods = PeriodService.getPeriods($scope.model.selectedPeriodType, $scope.model.periodOffset, $scope.model.openFuturePeriods);
        }
    };

    $scope.getQuarters = function(){
        $scope.model.selectedQuarters = PeriodService.getQuarters( $scope.model.selectedPeriod );
    };


    $scope.getAnalyticsData = function(){

        $scope.model.data = null;

        if( !$scope.selectedOrgUnit || !$scope.selectedOrgUnit.id ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_vote"));
            return;
        }

        if( !$scope.model.llgFinanceDataSet ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("missing_llg_finance_dataset"));
            return;
        }

        $scope.getQuarters();

        if ( $scope.model.selectedQuarters.length === 0 ){
            NotificationService.showNotifcationDialog($translate.instant("error"), $translate.instant("please_select_period"));
            return;
        }

        var dataValueSetUrl = 'children=true&dataSet=' + $scope.model.llgFinanceDataSet.id;
        $scope.model.selectedQuarters = orderByFilter( $scope.model.selectedQuarters, '-id').reverse();

        $scope.model.dataHeaders = [];
        $scope.model.dataHeaders.push({id: 'fundType', name: $translate.instant('fund_type')});
        $scope.model.dataHeaders.push({id: 'sector', name: $translate.instant('sector')});
        $scope.model.dataHeaders.push({id: 'parentLgCode', name: $translate.instant('parent_lg_code')});
        $scope.model.dataHeaders.push({id: 'parentLgName', name: $translate.instant('parent_lg_name')});
        $scope.model.dataHeaders.push({id: 'subCounty', name: $translate.instant('sub_county')});
        $scope.model.dataHeaders.push({id: 'workPlan', name: $translate.instant('work_plan')});
        $scope.model.dataHeaders.push({id: 'programme', name: $translate.instant('programme')});
        $scope.model.dataHeaders.push({id: 'output', name: $translate.instant('output')});
        $scope.model.dataHeaders.push({id: 'item', name: $translate.instant('item')});

        $scope.sortHeader = $scope.model.dataHeaders[0];

        $scope.model.sortHeader = 'fundType';

        angular.forEach($scope.model.selectedQuarters, function(q){
            dataValueSetUrl += '&period=' + q.id;
            $scope.model.dataHeaders.push({id: q.sortName, name: q.name});
        });

        $scope.model.dataHeaders.push({id: 'cumFinancialYear', name: $translate.instant('cum_financial_year')});

        dataValueSetUrl += '&orgUnit=' + $scope.selectedOrgUnit.id;

        var metadata = {
            optionCombos: $scope.model.mappedOptionCombos,
            programmeInfo: $scope.model.programmeInfo,
            dataElements: $scope.model.dataElementsById,
            llgInfo: $scope.model.llgs,
            periods: $scope.model.selectedQuarters,
            periodsBySortName: $scope.model.selectedQuarters.reduce(function(map, obj){ map[obj.id] = obj; return map;}, {})
        };

        $scope.model.reportReady = false;
        $scope.model.reportStarted = true;
        Analytics.getFinancialData( dataValueSetUrl, metadata ).then(function(data){
            $scope.model.dataExists = data && data.length && data.length > 0 || false;
            $scope.model.data = data;
            $scope.model.reportReady = true;
            $scope.model.reportStarted = false;
        });
    };

    $scope.showOrgUnitTree = function(){
        var modalInstance = $modal.open({
            templateUrl: 'components/outree/orgunit-tree.html',
            controller: 'OuTreeController',
            resolve: {
                orgUnits: function(){
                    return $scope.orgUnits;
                },
                selectedOrgUnit: function(){
                    return $scope.selectedOrgUnit;
                },
                validOrgUnits: function(){
                    return Object.keys( $scope.model.llgs );
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                $scope.selectedOrgUnit = selectedOu;
                $scope.resetDataView();
            }
        });
    };

    $scope.filterData = function(header, dataElement){
        if(!header || !$scope.model.data || !header.periodId || !header.dimensionId || !dataElement) return;
        var res = $filter('filter')($scope.model.data, {dx: dataElement, Duw5yep8Vae: header.dimensionId, pe: header.periodId})[0];
        return res && res.value ? res.value : '';
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });
        var reportName = $translate.instant('llg_financial_performance') + '_' + $scope.model.selectedPeriod._startDate._year + '_' + $scope.model.selectedPeriod._endDate._year +'.xls';
        saveAs(blob, reportName);
    };

    $scope.getIndicatorDictionary = function(item) {
        var modalInstance = $modal.open({
            templateUrl: 'components/dictionary/details-modal.html',
            controller: 'DictionaryDetailsController',
            resolve: {
                dictionaryItem: function(){
                    return item;
                }
            }
        });

        modalInstance.result.then(function () {

        });
    };

    $scope.getDataValueExplanation = function( item ){
        var modalInstance = $modal.open({
            templateUrl: 'components/explanation/explanation-modal.html',
            controller: 'DataValueExplanationController',
            windowClass: 'comment-modal-window',
            resolve: {
                item: function(){
                    return item;
                }
            }
        });

        modalInstance.result.then(function () {

        });
    };
});