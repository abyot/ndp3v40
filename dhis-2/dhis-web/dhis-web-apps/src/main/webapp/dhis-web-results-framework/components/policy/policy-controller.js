/* Controllers */

/* global ndpFramework, parseFloat */

ndpFramework.controller('PolicyController',
    function($scope,
        $translate,
        $modal,
        $filter,
        Paginator,
        SelectedMenuService,
        MetaDataFactory,
        ProgramFactory,
        OrgUnitFactory,
        ProjectService) {

    $scope.model = {
        metaDataCached: false,
        showOnlyCoreProject: false,
        data: null,
        reportReady: false,
        dataExists: false,
        dataHeaders: [],
        optionSetsById: [],
        optionSets: [],
        objectives: [],
        dataElementGroup: [],
        selectedDataElementGroupSets: [],
        dataElementGroups: [],
        selectedNdpProgram: null,
        ndpProgrammes: [],
        selectedPeriods: [],
        periods: [],
        periodOffset: 0,
        openFuturePeriods: 10,
        selectedPeriodType: 'FinancialJuly',
        coreProjectAttribute: null,
        bac: null,
        ac: null,
        timePerformance: [],
        costPerformance: [],
        showProjectFilter: false,
        filterText: {}
    };

    //Paging
    $scope.pager = {pageSize: 50, page: 1, toolBarDisplay: 5};

    $scope.model.horizontalMenus = [
        {id: 'synthesis', title: 'project_synthesis', order: 1, view: 'components/policy/synthesis.html', active: true, class: 'main-horizontal-menu'},
        {id: 'time_performance', title: 'time_performance', order: 2, view: 'components/policy/time-performance.html', class: 'main-horizontal-menu'},
        {id: 'cost_performance', title: 'cost_performance', order: 3, view: 'components/policy/cost-performance.html', class: 'main-horizontal-menu'}
    ];

    $scope.model.performanceHeaders = [
        {id: 'KPI', displayName: $translate.instant("kpi"), order: 1},
        {id: 'IND', displayName: $translate.instant('indicator'), order: 2},
        {id: 'INT', displayName: $translate.instant('interpretation'), order: 3},
        {id: 'UNI', displayName: $translate.instant('unit'), order: 4},
        {id: 'BSL', displayName: $translate.instant('baseline'), order: 5}
    ];

    $scope.$watch('model.selectedProgram', function(){
        $scope.resetData();
        if ( $scope.model.selectedMenu && $scope.model.selectedMenu.code ){
            $scope.fetchProgramDetails();
        }
    });


    MetaDataFactory.getAll('optionSets').then(function(optionSets){

        $scope.model.optionSets = optionSets;

        angular.forEach(optionSets, function(optionSet){
            $scope.model.optionSetsById[optionSet.id] = optionSet;
        });

        $scope.model.ndp = $filter('getFirst')($scope.model.optionSets, {code: 'ndp'});

        ProgramFactory.getAll('programs').then(function(programs){
            $scope.model.programs = $filter('filter')(programs, {programType: 'WITH_REGISTRATION', programDomain: 'policyAction'}, true);
            $scope.model.selectedMenu = SelectedMenuService.getSelectedMenu();

            //Get orgunits for the logged in user
            OrgUnitFactory.getViewTreeRoot().then(function(response) {
                $scope.orgUnits = response.organisationUnits;
                angular.forEach($scope.orgUnits, function(ou){
                    ou.show = true;
                    angular.forEach(ou.children, function(o){
                        o.hasChildren = o.children && o.children.length > 0 ? true : false;
                    });
                });
                $scope.selectedOrgUnit = $scope.orgUnits[0] ? $scope.orgUnits[0] : null;
            });
        });
    });

    $scope.fetchProgramDetails = function(){
        $scope.model.coreProjectAttribute = null;
        $scope.pager = {pageSize: 50, page: 1, toolBarDisplay: 5};
        $scope.model.filterText = {};
        if( $scope.model.selectedMenu && $scope.model.selectedMenu.code && $scope.model.selectedProgram && $scope.model.selectedProgram.id && $scope.model.selectedProgram.programTrackedEntityAttributes ){

            angular.forEach($scope.model.selectedProgram.programTrackedEntityAttributes, function(pta){
                $scope.model.attributesById[pta.trackedEntityAttribute.id] = pta.trackedEntityAttribute;
            });

            angular.forEach($scope.model.selectedProgram.programStages, function(stage){
                angular.forEach(stage.programStageDataElements, function(prstDe){
                    var de = prstDe.dataElement;
                    if( de ){
                        $scope.model.dataElementsById[de.id] = de;
                    }
                });
            });
            $scope.fetchProjects();
        }
    };

    $scope.fetchProjects = function(){
        $scope.model.projectFetchStarted = true;
        var filter = [];
        if ( Object.keys( $scope.model.filterText ).length > 0 ){
            for(var key in $scope.model.filterText ){
                if ( $scope.model.filterText[key] && $scope.model.filterText[key] !== '' )
                filter.push( "&filter=" + key + ':LIKE:' + $scope.model.filterText[key] );
            }
        }

        ProjectService.getByProgram($scope.pager, filter.length > 0 ? filter.join('&') : null, $scope.selectedOrgUnit, $scope.model.selectedProgram, $scope.model.optionSetsById, $scope.model.attributesById, $scope.model.dataElementsById ).then(function( response ){
            $scope.model.projects = response.projects;
            $scope.model.projectsFetched = true;
            $scope.model.projectFetchStarted = false;

            response.pager.pageSize = response.pager.pageSize ? response.pager.pageSize : $scope.pager.pageSize;
            $scope.pager = response.pager;
            $scope.pager.toolBarDisplay = 5;
            $scope.pager.length = $scope.model.projects.length;

            Paginator.setPage($scope.pager.page);
            Paginator.setPageCount($scope.pager.pageCount);
            Paginator.setPageSize($scope.pager.pageSize);
            Paginator.setItemCount($scope.pager.total);
        });
    };

    $scope.searchProjects = function(){
        $scope.fetchProjects();
    };

    $scope.jumpToPage = function(){
        if($scope.pager && $scope.pager.page && $scope.pager.pageCount && $scope.pager.page > $scope.pager.pageCount){
            $scope.pager.page = $scope.pager.pageCount;
        }
        $scope.fetchProjects();
    };

    $scope.resetPageSize = function(){
        $scope.pager.page = 1;
        $scope.fetchProjects();
    };

    $scope.getPage = function(page){
        $scope.pager.page = page;
        $scope.fetchProjects();
    };

    $scope.resetData = function(){
        $scope.model.attributesById = [];
        $scope.model.dataElementsById = [];
        $scope.model.projectsFetched = false;
        $scope.model.projects = [];
    };

    $scope.resetView = function(horizontalMenu, e){
        $scope.model.activeHorizontalMenu = horizontalMenu;
        if(e){
            e.stopPropagation();
            e.preventDefault();
        }
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
                    return null;
                }
            }
        });

        modalInstance.result.then(function ( selectedOu ) {
            if( selectedOu && selectedOu.id ){
                $scope.selectedOrgUnit = selectedOu;
                $scope.resetData();
            }
        });
    };

    $scope.exportData = function ( name ) {
        var blob = new Blob([document.getElementById('exportTable').innerHTML], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8"
        });

        var reportName = $scope.model.selectedProgram.displayName + " - project status" + " .xls";
        if( name ){
            reportName = name + ' performance.xls';
        }
        saveAs(blob, reportName);
    };
});